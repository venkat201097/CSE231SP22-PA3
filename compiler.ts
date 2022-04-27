import { Set } from "typescript";
import {Expr, Program, Type, Literal, Stmt, VarDef, TypedVar, FuncDef, FuncBody, ClassDef} from './ast';
import { parse, traverseFuncDefArgList } from "./parser";
import {typeCheckProgram} from "./typechecker";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;
var loop_counter : number = 0;
type CompileResult = {
  wasmSource: {
    funcDefCode?: string,
    classDefCode: string,
    varDefCode: string,
    stmtsCode: string,
  }
};

export function compile(source: string) : CompileResult {
  var untypedast = parse(source);
  var ast = typeCheckProgram(untypedast);
  const definedVars = new Set();

  const classFieldToOffset: Map<string, Map<string, number>> = new Map();
  ast.classdefs.forEach(classdef => {
    classFieldToOffset.set(classdef.name, new Map());
    classdef.fielddefs.forEach((fielddef, index) => {
      classFieldToOffset.get(classdef.name).set(fielddef.name, index);
    })
  })

  const scratchVar : string = `(local $scratch i32)`;
  const heapVar : string = `(global $heap (mut i32) (i32.const 4))`
  const varDefCode : string = heapVar + codeGenVarDefs(ast.vardefs, "global");
  // const funcDefCode : string = ast.funcdefs.map(funcdef => codeGenFuncDef(funcdef, classFieldToOffset)).join('');
  const classDefCode : string = ast.classdefs.map(classdef => codeGenClassDef(classdef, classFieldToOffset)).join('');
  const stmtsCode : string = scratchVar + codeGenBody(ast.stmts, classFieldToOffset );
  
  return {
    wasmSource: {
      funcDefCode: '',
      classDefCode: classDefCode,
      varDefCode: varDefCode,
      stmtsCode: stmtsCode
    }
  };
}

function codeGenRetType(retType: Type) : string {
  if(retType.tag==="none")
    return "(result i32)";
  return "(result i32)";
}

function codeGenArgs(args: TypedVar<Type>[]) : string {
  return args.map(arg => `(param $${arg.name} i32)`).join('')
}

function codeGenVarDefs(varDefs : VarDef<Type>[], scope : string) : string {
  if(scope==="global")
    return varDefs.map(varDef => `(global $${varDef.name} (mut i32) (i32.const ${varDef.value.value}))`).join('');
  // const defineStmts : string[] = [];
  // const initStmts : string[] = [];
  const defineStmts : string = varDefs.map(varDef => `(local $${varDef.name} i32)`).join('');
  const initStmts : string = varDefs.map(varDef => `
  (i32.const ${varDef.value.value})
  (local.set $${varDef.name})`).join('');
  // varDefs.forEach(varDef => {
  //   defineStmts.push(`(local $${varDef.name} i32)`);
  //   initStmts.push(`(i32.const $${varDef.value})(local.set $${varDef.name})`);
  // })
  // return (defineStmts.concat(initStmts)).join('');
  return defineStmts + initStmts;
}

function codeGenClassDef(classdef: ClassDef<Type>, classFieldToOffset: Map<any, any>) : string {
  // classdef.methoddefs.forEach(methoddef => {console.log(`${methoddef.name}$${classdef.name}`);});
  const methodsCode = classdef.methoddefs.map(methoddef => codeGenFuncDef(methoddef, classFieldToOffset, `${methoddef.name}$${classdef.name}`)).join('')
  const constructorCode = codeGenConstructor(classdef);
  return methodsCode+constructorCode;
}

function codeGenConstructor(classdef: ClassDef<Type>) : string {
  const constructorCode : string[] = [
  `(local $scratch i32)
  (global.get $heap)
  (i32.const 0)
  (i32.store)`
  ];
  var fieldIndex : number = 0
  classdef.fielddefs.forEach(field => {
    constructorCode.push(`
    (global.get $heap)
    (i32.add (i32.const ${fieldIndex*4 + 4}))
    (i32.const ${field.value.value})
    (i32.store)`);
    fieldIndex++;
  })
  var getObjectForCallInitCode : string = '';
  var callInitCode : string = '';
  if(classdef.methoddefs!==undefined && new Set(classdef.methoddefs.map(methoddef => methoddef.name)).has('__init__')){
    getObjectForCallInitCode = `
    (global.get $heap)`;
    callInitCode = `
    (call $__init__$${classdef.name})
    (local.set $scratch)`;
  }
    
  constructorCode.push(`
  (global.get $heap)
  ${getObjectForCallInitCode}
  (global.get $heap)
  (i32.add (i32.const ${fieldIndex*4 + 4}))
  (global.set $heap)
  ${callInitCode}
  `);

  return `(func $${classdef.name} (result i32) ${constructorCode.join('')})`
}

function getFieldOffset(classType: Type, field: string, classFieldToOffset: Map<any, any> = new Map()) : number {
  if(classType.tag!=="object")
    throw new Error();
  return classFieldToOffset.get(classType.class).get(field);
}

function codeGenBody(stmts: Stmt<Type>[], classFieldToOffset: Map<any, any> = new Map(), localVars : Map<string, true> = new Map()) : string {
  return stmts.map(stmt => codeGenStmt(stmt, classFieldToOffset, localVars)).join('');
}

function getLocalVars(funcdef: FuncDef<Type>) : Map<string, true>{
  const localVars : Map<string, true> = new Map();
  funcdef.args.forEach(arg => {
    localVars.set(arg.name, true);
  })
  funcdef.body.vardefs.forEach(vardef => {
    localVars.set(vardef.name, true);
  })
  return localVars;
}

function codeGenFuncDef(funcDef: FuncDef<Type>, classFieldToOffset: Map<any, any> = new Map(), name: string = null) : string {
  const localVars = getLocalVars(funcDef);
  // console.log(localVars);
  const retTypeCode = codeGenRetType(funcDef.rettype);
  var returnCode = '(local.get $scratch)';
  // if(retTypeCode==='')
  //   returnCode = '';
  // else
  //   returnCode = '(local.get $scratch)';
  const argsCode = codeGenArgs(funcDef.args);
  const varDefsCode = `(local $scratch i32)` + codeGenVarDefs(funcDef.body.vardefs, "local");
  const bodyStmtsCode = codeGenBody(funcDef.body.stmts, classFieldToOffset, localVars);
  if(name!==undefined)
    return `(func $${name} ${argsCode} ${retTypeCode}
      ${varDefsCode}
      ${bodyStmtsCode}
      ${returnCode})`;
  return `(func $${funcDef.name} ${argsCode} ${retTypeCode} ${varDefsCode} ${bodyStmtsCode} ${returnCode})`;
  
}

function codeGenStmt(stmt : Stmt<Type>, classFieldToOffset: Map<any, any> = new Map(), localVars : Map<string, true> = new Map()) : string {
  switch(stmt.tag){
    case "assign":
      const valueCode = codeGenExpr(stmt.value, classFieldToOffset, localVars);
      var scope : string;
      if(stmt.lhs.tag==="id"){
        if(localVars.has(stmt.lhs.name))
          scope = "local"
        else
          scope = "global"
        return `${valueCode}(${scope}.set $${stmt.lhs.name})`;  
      }
      else{
        const objCode = codeGenExpr(stmt.lhs.obj, classFieldToOffset, localVars);
        const checkOperationOnNoneCode = `
        (local.set $scratch)
        (local.get $scratch)
        (local.get $scratch)
        (i32.const 0)
        (i32.eq)
        (if
          (then
            (call $runtimeError)
          )
        )`;
        var fieldCode = `(i32.add (i32.const ${getFieldOffset(stmt.lhs.obj.a, stmt.lhs.field, classFieldToOffset)*4 + 4}))`;
        // const objCode = codeGenExpr(stmt.lhs, classFieldToOffset, localVars);
        return `${objCode} ${checkOperationOnNoneCode} ${fieldCode} ${valueCode} (i32.store)`
      }
    
    case "pass":
      return ''

    case "return":
      var retValueCode = ''
      if(stmt.expr!==undefined)
        retValueCode = codeGenExpr(stmt.expr, classFieldToOffset, localVars);
      else
        retValueCode = '(local.get $scratch)'
      return `${retValueCode}(return)`;
    
    case "expr":
      return codeGenExpr(stmt.expr, classFieldToOffset, localVars) + `(local.set $scratch)`;
    
    case "if":
      return codeGenIfStatement(stmt, classFieldToOffset, localVars);
    
  //   case "while":
  //     const conditionCode = codeGenExpr(stmt.condition, classFieldToOffset, localVars);
  //     const bodyStmtsCode = codeGenBody(stmt.body, classFieldToOffset, localVars);
  //     return `(block $block_${loop_counter} 
  //               (loop $loop_${loop_counter} 
  //                 ${conditionCode} (i32.const 1)(i32.xor)
  //                 (br_if $block_${loop_counter})
  //                 ${bodyStmtsCode}
  //                 (br $loop_${loop_counter++})
  //               )
  //             )`
  }
}

function codeGenIfStatement(stmt : Stmt<Type>, classFieldToOffset: Map<any, any> = new Map(), localVars : Map<string, true> = new Map()) : string {
  if(stmt.tag!=="if") throw new Error();
  const bodyCode = codeGenBody(stmt.body, classFieldToOffset, localVars);
  if(stmt.ifcondition==undefined)
    return bodyCode;
  const ifConditionCode = codeGenExpr(stmt.ifcondition, classFieldToOffset, localVars);
  var elseBlockCode : string = '';
  if(stmt.elseblock!==undefined)
    elseBlockCode = `(else
                        ${codeGenIfStatement(stmt.elseblock, classFieldToOffset, localVars)}
                      )`
  return `${ifConditionCode}
          (if
            (then
              ${bodyCode}
            )
            ${elseBlockCode}
          )`
}

function codeGenExpr(expr : Expr<any>, classFieldToOffset: Map<any, any> = new Map(), localVars : Map<string, true> = new Map(), fieldAccess:'attribute'|'method' = 'attribute') : string {
  var exprCode : string[] = [];
  switch(expr.tag) {
    case "literal":
      switch(expr.value.tag){
        case "number":
          exprCode = ["(i32.const " + expr.value.value + ")"];  break;
        case "boolean":
          exprCode = ["(i32.const " + expr.value.value + ")"];  break;
        case "none":
          exprCode = ["(i32.const " + expr.value.value + ")"];  break;
      }
      break;
    case "id":
      var scope : string;
      if(!localVars.has(expr.name))
        scope = "global";
      else
        scope = "local"
      exprCode = [`(${scope}.get $${expr.name})`]; break;
    case "memberexpr":
      const objCode = codeGenExpr(expr.obj, classFieldToOffset, localVars);
      const checkOperationOnNoneCode = `
      (local.set $scratch)
      (local.get $scratch)
      (local.get $scratch)
      (i32.const 0)
      (i32.eq)
      (if
        (then
          (call $runtimeError)
        )
      )`;
      if(fieldAccess==='attribute')
        var fieldCode = `
        (i32.add (i32.const ${getFieldOffset(expr.obj.a, expr.field, classFieldToOffset)*4 + 4}))
        (i32.load)`;
      else
        var fieldCode = ``;
      exprCode = [objCode, checkOperationOnNoneCode, fieldCode];
      break;
    case "unaexpr":
      const oprndStmt = codeGenExpr(expr.oprnd, classFieldToOffset, localVars);
      var opStmt: string;
      switch(expr.op.tag){
        case "not": 
          exprCode.push(oprndStmt.concat("(i32.const 1)","(i32.xor)")); break;
        case "-": 
          exprCode = ["(i32.const 0)"].concat(oprndStmt,"(i32.sub)"); break;
      }
    break;
    case "binexpr":
      const op1Stmt = codeGenExpr(expr.l_oprnd, classFieldToOffset, localVars);
      const op2Stmt = codeGenExpr(expr.r_oprnd, classFieldToOffset, localVars);
      const pyop2watop:any = {"+":"add", "-":"sub", "*":"mul", "//":"div_s", "%":"rem_s",
      "==":"eq", "!=":"ne", ">=":"ge_s", "<=":"le_s", ">":"gt_s", "<":"lt_s", "is":"eq"}
      var opStmt = "(i32." + pyop2watop[expr.op.tag]+")";
      exprCode.push(op1Stmt.concat(op2Stmt, opStmt)); break;
    case "paranthexpr":
      exprCode.push(codeGenExpr(expr.expr, classFieldToOffset, localVars)); break;
    case "call":
      var funcNameCode : string = '';
      var funcName : string = '';
      var argListCode : string = '';
      if(expr.name.tag==="memberexpr"){
        funcNameCode = codeGenExpr(expr.name, classFieldToOffset, localVars, 'method');
        funcName = `${expr.name.field}$${expr.name.obj.a.class}`
      }
      else if(expr.name.tag==="id"){
        funcName = `${expr.name.name}`
        if(expr.name.name==="print"){
          // argListCode = codeGenPrint(expr.arglist[0].a);
          argListCode = expr.arglist.map(arg => codeGenExpr(arg, classFieldToOffset, localVars)).join('');

          return `${argListCode} ${codeGenPrintSeparate(expr.arglist[0].a)}`
          
        }
      }
      argListCode = expr.arglist.map(arg => codeGenExpr(arg, classFieldToOffset, localVars)).join('') + argListCode;
      exprCode.push(funcNameCode + argListCode + `(call $${funcName})`);      
  }
  return exprCode.join('');
  // return (exprCode.concat(['(local.set $scratch)'])).join('');
}

function codeGenPrintSeparate(type: Type) : string {
  const type2Func = new Map([
    ["int", "print_num"], ["bool", "print_bool"], ["none", "print_none"], ["object", "print"]
  ]);
  return `(call $${type2Func.get(type.tag)})`
}

function codeGenPrint(type: Type) : string {
  // console.log(type)
  const type2TypeFlag = new Map([
    ["int", 0], ["bool", 1], ["none", 2], ["object", 2]
  ]);
  return `(i32.const ${type2TypeFlag.get(type.tag)})`;
}

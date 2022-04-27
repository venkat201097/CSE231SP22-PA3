import { assert } from 'console';
import exp from 'constants';
import { stringify } from 'querystring';
import { isTypeAliasDeclaration } from 'typescript';
import { EnvironmentPlugin } from 'webpack';
import {Expr, Program, Type, Literal, Stmt, VarDef, FuncDef, FuncBody, ClassDef, LValue} from './ast';
import { typeCheck } from './tests/helpers.test';

type VarMapEnv = Map<string, Type>
type FuncMapEnv = Map<string, { arglist:Type[], retType: Type }>
type TypeEnv = {
    vars?: VarMapEnv,
    funcs?: FuncMapEnv,
    classes?: Map<string, { fields: VarMapEnv, methods: FuncMapEnv}>,
    retType: Type
}
export type Env = {
    localEnv?: TypeEnv
    globalEnv: TypeEnv
}

function createNewScopeEnv(env: Env) : Env {
    return {
        localEnv: { vars: new Map(), funcs: new Map(), retType: {tag:"none"}},
        globalEnv: env.globalEnv
    }
}

function getBuiltIns() : Map<string, { arglist:Type[], retType: Type }>{
    var builtins : Map<string, { arglist:Type[], retType: Type }> = new Map();
    builtins.set("print", {arglist: [{tag:"any"}], retType: {tag:"none"}});
    builtins.set("abs", {arglist: [{tag:"int"}], retType: {tag:"int"}});
    builtins.set("max", {arglist: [{tag:"int"}, {tag:"int"}], retType: {tag:"int"}});
    builtins.set("min", {arglist: [{tag:"int"}, {tag:"int"}], retType: {tag:"int"}});
    builtins.set("pow", {arglist: [{tag:"int"}, {tag:"int"}], retType: {tag:"int"}});

    return builtins
}

export function typeCheckProgram(program: Program<null>) : Program<Type>{
    var programType : Type = {tag:"none"};
    const typedStmts : Stmt<Type>[] = [];
    const typedVarDefs : VarDef<Type>[] = [];
    const typedClassDefs : ClassDef<Type>[] = [];
    // const typedFuncDefs : FuncDef<Type>[] = [];

    var env: Env = {
        globalEnv: {
            vars: new Map<string,Type>(), 
            funcs: getBuiltIns(),
            classes: new Map<string, { fields: VarMapEnv, methods: FuncMapEnv}>(),
            retType: {tag:"none"}
        }
    }

    program.classdefs.forEach((classdef) => {
        if(env.globalEnv.classes.has(classdef.name))
            throw new Error("Duplicate declaration of variable in same scope: " + classdef.name);
        env.globalEnv.classes.set(classdef.name, {fields: new Map(), methods: new Map()})
        env.globalEnv.funcs.set(classdef.name, {arglist: [], retType: {tag: "object", class: classdef.name}})
    })

    program.vardefs.forEach((vardef) => {
        const typedVarDef = typeCheckVarDef(vardef, env);
        typedVarDefs.push(typedVarDef);
    })

    program.classdefs.forEach((classdef) => {
        const typedClassDef = typeCheckClassDef(classdef, env);
        typedClassDefs.push(typedClassDef);
    })

    // program.funcdefs.forEach(funcdef => {
    //     if(env.globalEnv.funcs.has(funcdef.name))
    //         throw new Error("Duplicate declaration of variable in same scope: " + funcdef.name);

    //     env.globalEnv.funcs.set(funcdef.name, {arglist: funcdef.args.map(i => i.typedef), retType: funcdef.rettype})
    // })
    
    // program.funcdefs.forEach(funcdef => {
    //     const typedFuncDef = typeCheckFuncDef(funcdef, createNewScopeEnv(env))
    //     typedFuncDefs.push(typedFuncDef);
    // })

    program.stmts.forEach((stmt) => {
        const typedStmt = typeCheckStmt(stmt, env);
        typedStmts.push(typedStmt);
    })
    if(typedStmts.length>0)
        programType = typedStmts[typedStmts.length-1].a;    
    // console.log(env)
    return {...program, a: programType, vardefs:typedVarDefs, classdefs: typedClassDefs, stmts: typedStmts}
}

function isTypeEqual(a: Type, b: Type) : boolean {
    if(a.tag==="object" && b.tag==="object")
        return a.class===b.class
    return a.tag===b.tag
}

function assignableTo(a: Type, b: Type) : boolean {
    if(a.tag==="object")
        return (b.tag==="object" && a.class===b.class) || b.tag==="none"
    return a.tag===b.tag
}

function getTypeName(a: Type) : string {
    if(a.tag==="object")
        return a.class
    return a.tag
}

export function typeCheckVarDef(vardef: VarDef<null>, env: Env) : VarDef<Type> {
    const typedType = typeCheckType(vardef.typedef, env);
    const typedValue = typeCheckLiteral(vardef.value);
    // if(!isTypeEqual(typedValue.a, typedType))
    if(!assignableTo(typedType, typedValue.a))
        throw new Error(`TYPE ERROR: Expected type <${getTypeName(vardef.typedef)}>; got type <${getTypeName(typedValue.a)}>`);
    if(env.localEnv==undefined){
        if(env.globalEnv.vars.has(vardef.name) || env.globalEnv.funcs.has(vardef.name) || env.globalEnv.classes.has(vardef.name))
            throw new Error("Duplicate declaration of variable in same scope: " + vardef.name);
        env.globalEnv.vars.set(vardef.name, vardef.typedef)
    }
    else if(env.localEnv.vars.has(vardef.name))
        throw new Error("Duplicate declaration of variable in same scope: " + vardef.name);
    else
        env.localEnv.vars.set(vardef.name, vardef.typedef)
    return {...vardef, a: vardef.typedef, value: typedValue}
}

export function typeCheckClassDef(classdef: ClassDef<null>, env:Env) : ClassDef<Type> {
    const typedFieldDefs : VarDef<Type>[] = [];
    const typedMethodDefs : FuncDef<Type>[] = [];

    var classEnvMap: { fields: VarMapEnv, methods: FuncMapEnv} = {fields:new Map(), methods:new Map()};

    var classenv: Env = createNewScopeEnv(env);

    classdef.fielddefs.forEach((fielddef) => {
        const typedFieldDef = typeCheckVarDef(fielddef, classenv);
        typedFieldDefs.push(typedFieldDef);
    })

    classEnvMap.fields = classenv.localEnv.vars;
    env.globalEnv.classes.get(classdef.name).fields = classEnvMap.fields;

    classdef.methoddefs.forEach((methoddef) => {
        if(classEnvMap.fields.has(methoddef.name))
            throw new Error("Duplicate declaration of variable in same scope: " + methoddef.name);

        classEnvMap.methods.set(methoddef.name, {arglist: methoddef.args.map(i => typeCheckType(i.typedef, env)), retType: typeCheckType(methoddef.rettype, env)});
    })
    env.globalEnv.classes.get(classdef.name).methods = classEnvMap.methods;

    classdef.methoddefs.forEach((methoddef) => {
        const typedMethodDef = typeCheckFuncDef(methoddef, createNewScopeEnv(env));
        typedMethodDefs.push(typedMethodDef);
    })

    return {...classdef, a: {tag:"none"}, fielddefs: typedFieldDefs, methoddefs: typedMethodDefs}
}

function typeCheckType(type: Type, env: Env) : Type{
    if(type===undefined)
        return {tag:"none"}
    if(type.tag==="object" && !env.globalEnv.classes.has(type.class))
        throw new Error(`TYPE ERROR: Invalid type annotation; there is no class named : ${type.class}`);
    return type;
}

export function typeCheckFuncDef(funcdef: FuncDef<null>, env:Env) : FuncDef<Type> {
    funcdef.args.forEach(arg => {
        env.localEnv.vars.set(arg.name, arg.typedef);
    })
    env.localEnv.retType = funcdef.rettype;
    const typedBody = typeCheckFuncBody(funcdef.body, env);
    if(!assignableTo(env.localEnv.retType, typedBody.a))
        throw new Error(`TYPE ERROR: All paths in this function/method must have a return statement: ${funcdef.name}`);
    return {...funcdef, body: typedBody, a:env.localEnv.retType}
}

export function typeCheckFuncBody(funcbody: FuncBody<null>, env: Env) : FuncBody<Type> {
    const typedVarDefs : VarDef<Type>[] = [];
    funcbody.vardefs.forEach(vardef => {
        typedVarDefs.push(typeCheckVarDef(vardef, env));
    })

    const [typedStmts, rettype]:[Stmt<Type>[], Type] = typeCheckBody(funcbody.stmts, env);
    return {...funcbody, vardefs: typedVarDefs, stmts: typedStmts, a:rettype};

}

export function typeCheckIfStatement(stmt: Stmt<null>, env: Env) : Stmt<Type> {
    if(stmt.tag!=="if")
        throw new Error();
    const [typedBody, rettype]:[Stmt<Type>[], Type] = typeCheckBody(stmt.body, env);
    if(stmt.ifcondition==undefined)
        return {...stmt, body:typedBody, a:rettype};
    var typedCondition = typeCheckExpr(stmt.ifcondition, env);
    if(stmt.elseblock==undefined){
        if(typedCondition.a.tag!=="bool")
            throw new Error(`Condition expression cannot be of type <${typedCondition.a}>`);
        return {...stmt, body:typedBody, ifcondition:typedCondition, a:{tag:"none"}};
    }
    const typedElse = typeCheckIfStatement(stmt.elseblock, env);
    if(typedElse.a.tag=="none" || rettype.tag=="none")
        return {...stmt, body:typedBody, ifcondition:typedCondition, elseblock:typedElse ,a:{tag:"none"}};
    return {...stmt, body:typedBody, ifcondition:typedCondition, elseblock:typedElse, a:rettype};

}

export function typeCheckBody(body: Stmt<null>[], env: Env) : [Stmt<Type>[], Type] {
    var rettype : Type = {tag:"none"};
    const typedBody : Stmt<Type>[] = [];
    body.forEach(stmt => {
        const typedStmt = typeCheckStmt(stmt, env);
        rettype = typedStmt.a;
        typedBody.push(typedStmt);
    })
    return [typedBody, rettype];
}

export function typeCheckStmt(stmt: Stmt<null>, env: Env) : Stmt<Type> {
    switch(stmt.tag){
        case "assign":
            const typedValue = typeCheckExpr(stmt.value, env);

            if(stmt.lhs.tag==="memberexpr"){
                const typedLhs = typeCheckExpr(stmt.lhs, env);
                if(typedLhs.tag==="memberexpr")
                    return {...stmt, a:{tag:"none"}, lhs:{tag: "memberexpr", a: typedLhs.a, obj:typedLhs.obj, field: typedLhs.field}, value:typedValue}
                else
                    return;
            }
            if(env.localEnv==undefined)
                if(!env.globalEnv.vars.has(stmt.lhs.name))
                    throw new Error(`ReferenceError: Not a variable: ${stmt.lhs.name}`);
                else
                    var vartype = env.globalEnv.vars.get(stmt.lhs.name)
            else if(!env.localEnv.vars.has(stmt.lhs.name))
                if(!env.globalEnv.vars.has(stmt.lhs.name))
                    throw new Error(`ReferenceError: Not a variable: ${stmt.lhs.name}`);
                else
                    throw new Error(`Cannot assign to variable that is not explicitly declared in this scope: ${stmt.lhs.name}`);
            else
                var vartype = env.localEnv.vars.get(stmt.lhs.name)
            if(!assignableTo(vartype, typedValue.a))
                throw new Error(`TYPE ERROR: Expected type <${vartype}>; got type <${typedValue.a}>`);
            return {...stmt, a:{tag:"none"}, value:typedValue}
            
        
        // case "while":
        //     const typedCondition = typeCheckExpr(stmt.condition, env);
        //     if(typedCondition.a!=="bool")
        //         throw new Error(`Condition expression cannot be of type <${typedCondition.a}>`);
        //     const [typedBody, rettype]:[Stmt<Type>[], Type] = typeCheckBody(stmt.body, env);
        //     return {...stmt, a:"none", condition:typedCondition, body:typedBody}
        
        case "if":
            return typeCheckIfStatement(stmt, env);
        
        case "expr":
            const typedExpr = typeCheckExpr(stmt.expr, env);
            // return {...stmt, a: {tag:"none"}, expr: typedExpr}
            return {...stmt, a: typedExpr.a, expr: typedExpr}
        
        case "pass":
            return {...stmt, a: {tag:"none"}};
        
        case "return":
            if(env.localEnv==undefined)
                throw new Error(`Return statement cannot appear at the top level`);
            var retType : Type;
            if(stmt.expr===undefined)
                retType = {tag: "none"};
            else{
                var typedReturnExpr = typeCheckExpr(stmt.expr, env);
                retType = typedReturnExpr.a
            }
            if(!assignableTo(env.localEnv.retType, retType))
                throw new Error(`TYPE ERROR: Expected type <${getTypeName(env.localEnv.retType)}>; got type <${getTypeName(retType)}>`);
            if(stmt.expr==undefined)
                return {...stmt, a:retType}
            return {...stmt, a:retType, expr: typedReturnExpr}

    }
}

export function typeCheckExpr(expr: Expr<null>, env: Env, fieldAccess:'attribute'|'method' = 'attribute') : Expr<Type> {
    switch(expr.tag){
        case "id": 
            if(env.localEnv==undefined)
                if(!env.globalEnv.vars.has(expr.name))
                    throw new Error(`ReferenceError: Not a variable: ${expr.name}`);
                else
                    return {...expr, a:env.globalEnv.vars.get(expr.name)}
            else
                if(!env.localEnv.vars.has(expr.name))
                    if(!env.globalEnv.vars.has(expr.name))
                        throw new Error(`ReferenceError: Not a variable: ${expr.name}`);  
                    else
                        return {...expr, a:env.globalEnv.vars.get(expr.name)}
                else
                    return {...expr, a:env.localEnv.vars.get(expr.name)}
        case "memberexpr":
            const typedObj = typeCheckExpr(expr.obj, env, 'attribute');
            if(typedObj.a.tag!=="object")
                throw new Error(`TYPE ERROR: There is no ${fieldAccess} named \`${expr.field}\` in class \`${typedObj.a.tag}\``);
            const classdata = env.globalEnv.classes.get(typedObj.a.class);
            switch(fieldAccess){
                case "attribute":
                    if(!classdata.fields.has(expr.field))
                        throw new Error(`TYPE ERROR: There is no attribute named \`${expr.field}\` in class \`${typedObj.a.tag}\``);
                    return {...expr, a: classdata.fields.get(expr.field), obj: typedObj}
                case "method":
                    if(!classdata.methods.has(expr.field))
                        throw new Error(`TYPE ERROR: There is no method named \`${expr.field}\` in class \`${typedObj.a.tag}\``);
                    return {...expr, a: {tag:"object", class: typedObj.a.class}, obj: typedObj}
            }
        case "literal":
            const typedLiteral = typeCheckLiteral(expr.value);
            return {...expr, a: typedLiteral.a, value: typedLiteral}
        
        case "call":
            var funcArgList:{ arglist:Type[], retType: Type } = {arglist:[], retType: {tag:"none"}};
            if(expr.name.tag==="id"){
                if(!env.globalEnv.funcs.get(expr.name.name))
                    throw new Error(`ReferenceError: Not a function or class: ${expr.name.name}`);
                else{
                    var typedName: Expr<Type> = {...expr.name, a:{tag:"none"}}
                    var funcname = expr.name.name;
                    funcArgList = env.globalEnv.funcs.get(funcname);
                }
            }
            else if(expr.name.tag==="memberexpr"){
                var typedName: Expr<Type> = typeCheckExpr(expr.name, env, 'method');
                if(typedName.tag==="memberexpr")
                    var funcname = typedName.field;
                if(typedName.tag==="memberexpr" && typedName.obj.a.tag==="object"){
                    funcArgList = env.globalEnv.classes.get(typedName.obj.a.class).methods.get(funcname);
                    funcArgList = {arglist: funcArgList.arglist.slice(1), retType:funcArgList.retType}
                }
            }
            const typedArgList : Expr<Type>[] = [];
            // const funcArgList = env.globalEnv.funcs.get(funcname);
            if(funcArgList.arglist.length!==expr.arglist.length)
                throw new Error(`Expected ${funcArgList.arglist.length} arguments; got ${expr.arglist.length}`)
            for(var i: number = 0; i<expr.arglist.length; i++){
                var typedArg = typeCheckExpr(expr.arglist[i], env);
                if(!assignableTo(funcArgList.arglist[i], typedArg.a) && funcArgList.arglist[i].tag!=="any")
                    throw new Error(`TYPE ERROR: Expected type <${getTypeName(funcArgList.arglist[i])}>; got type <${getTypeName(typedArg.a)}> in parameter ${i}`);
                typedArgList.push(typedArg);    
            }
            // console.log(JSON.stringify({...expr, a: funcArgList.retType, name: typedName, arglist: typedArgList}, null, 2))
            return {...expr, a: funcArgList.retType, name: typedName, arglist: typedArgList}

        case "binexpr":
            const typedl_oprnd = typeCheckExpr(expr.l_oprnd, env);
            const typedr_oprnd = typeCheckExpr(expr.r_oprnd, env);
            var binexprType : Type;
            if(new Set(["+","-","*","//","%"]).has(expr.op.tag)){
                if(typedl_oprnd.a.tag!="int" || typedr_oprnd.a.tag!="int")
                    throw new Error(`TYPE ERROR: Cannot perform operation ${expr.op.tag} on types <${getTypeName(typedl_oprnd.a)}> and <${getTypeName(typedr_oprnd.a)}>`)
                binexprType = {tag:"int"};
            }
            else if(new Set(["<=",">=","<",">"]).has(expr.op.tag)){
                if(typedl_oprnd.a.tag!="int" || typedr_oprnd.a.tag!="int")
                    throw new Error(`TYPE ERROR: Cannot perform operation ${expr.op.tag} on types <${getTypeName(typedl_oprnd.a)}> and <${getTypeName(typedr_oprnd.a)}>`)
                binexprType = {tag:"bool"};
            }
            else if(new Set(["==", "!="]).has(expr.op.tag)){
                if(typedl_oprnd.a.tag=="none" || typedr_oprnd.a.tag=="none" || typedl_oprnd.a.tag!=typedr_oprnd.a.tag)
                    throw new Error(`TYPE ERROR: Cannot perform operation ${expr.op.tag} on types <${getTypeName(typedl_oprnd.a)}> and <${getTypeName(typedr_oprnd.a)}>`)
                binexprType = {tag:"bool"};
            }
            else{
                if((typedl_oprnd.a.tag!=="none" && typedl_oprnd.a.tag!=="object") || (typedr_oprnd.a.tag!=="none" && typedr_oprnd.a.tag!=="object"))
                    throw new Error(`TYPE ERROR: Cannot perform operation ${expr.op.tag} on types <${getTypeName(typedl_oprnd.a)}> and <${getTypeName(typedr_oprnd.a)}>`)
                binexprType = {tag:"bool"};
            }
            return {...expr, a:binexprType, l_oprnd: typedl_oprnd, r_oprnd: typedr_oprnd};
        
        case "unaexpr":
            const typed_oprnd = typeCheckExpr(expr.oprnd, env);
            var unaexprType : Type;
            switch(expr.op.tag){
                case "-":
                    if(typed_oprnd.a.tag!=="int")
                        throw new Error(`TYPE ERROR: Cannot perform operation ${expr.op.tag} on type <${getTypeName(typed_oprnd.a)}>`);
                    unaexprType = {tag:"int"};
                break;
                case "not":
                    if(typed_oprnd.a.tag!=="bool")
                        throw new Error(`TYPE ERROR: Cannot perform operation ${expr.op.tag} on type <${getTypeName(typed_oprnd.a)}>`);
                    unaexprType = {tag:"bool"};
                break;
            }
            return {...expr, a: unaexprType, oprnd: typed_oprnd}
        
        case "paranthexpr":
            const typed_paranthexpr = typeCheckExpr(expr.expr, env);
            return {...expr, a: typed_paranthexpr.a, expr: typed_paranthexpr}
    }
}

export function typeCheckLiteral(literal: Literal<null>) : Literal<Type> {
    switch(literal.tag){
        case "number": 
            return {...literal, a: {tag:"int"}}
        case "boolean": 
            return {...literal, a: {tag:"bool"}}
        case "none": 
            return {...literal, a: {tag:"none"}}
    }
}
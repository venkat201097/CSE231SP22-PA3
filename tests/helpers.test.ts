import { importObject } from "./import-object.test";
import { typeCheckProgram } from "../typechecker";
import { compile } from "../compiler";
import { parse } from "../parser";
import { run as run2} from "../runner";
import wabt from "wabt";
// Modify typeCheck to return a `Type` as we have specified below
export function typeCheck(source: string) : Type {
  const program = parse(source);
  const typedProgram = typeCheckProgram(program);
  switch(typedProgram.a.tag){
    case "object": return CLASS(typedProgram.a.class);
    case "int": return "int";
    case "bool": return "bool";
    case "none": return "none";
    default: return "int"
  }
}

// Modify run to use `importObject` (imported above) to use for printing
export async function run(source: string) { 

  const myimportobject = {
    imports: importObject.imports,
    js: {
      mem: new WebAssembly.Memory({initial:10}),
      runtimeError: () => {
        throw new WebAssembly.RuntimeError('RUNTIME ERROR: Operation on None')
      }
    },
  }
  const wabtInterface = await wabt();
  const parsed = parse(source);
  var returnType = "";
  var returnExpr = "";
  // console.log(parsed.stmts)
  var lastExpr;
  if(parsed.stmts.length!==0){
    lastExpr = parsed.stmts[parsed.stmts.length-1];
    // console.log(parsed.stmts.length, parsed.stmts)
  }
  const compiled = compile(source);
  // const importObject = config.importObject;
  const wasmSource = `(module
    (import "js" "mem" (memory 10))
    (func $runtimeError (import "js" "runtimeError"))
    (func $print (import "imports" "print") (param i32) (result i32))
    (func $print_num (import "imports" "print_num") (param i32) (result i32))
    (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
    (func $print_none (import "imports" "print_none") (param i32) (result i32))
    (func $abs (import "imports" "abs") (param i32) (result i32))
    (func $max (import "imports" "max") (param i32 i32) (result i32))
    (func $min (import "imports" "min") (param i32 i32) (result i32))
    (func $pow (import "imports" "pow") (param i32 i32) (result i32))
    ${compiled.wasmSource.funcDefCode}
    ${compiled.wasmSource.classDefCode}
    ${compiled.wasmSource.varDefCode}
    (func (export "exported_func") ${returnType}
      ${compiled.wasmSource.stmtsCode}
      ${returnExpr}
    )
  )`;
  // console.log(wasmSource);
  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, myimportobject); //{imports: importObject.imports, js:importObject.js});
  const result = (wasmModule.instance.exports.exported_func as any)();
  return result;
}

type Type =
  | "int"
  | "bool"
  | "none"
  | { tag: "object", class: string }

export const NUM : Type = "int";
export const BOOL : Type = "bool";
export const NONE : Type = "none";
export function CLASS(name : string) : Type { 
  return { tag: "object", class: name }
};

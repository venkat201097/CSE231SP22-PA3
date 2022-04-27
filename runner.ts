// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import * as compiler from './compiler';
import {parse} from './parser';

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if(typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args : any) : any => {
    if(args[0] === "uncaughtException") { return; }
    else { return oldProcessOn.apply(process, args); }
  };
}

export async function run(source : string, config: any) : Promise<number> {
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
  const compiled = compiler.compile(source);
  const importObject = config.importObject;
  const wasmSource = `(module
    (import "js" "mem" (memory 10))
    (func $runtimeError (import "imports" "runtimeError"))
    (func $print (import "imports" "print") (param i32) (param i32) (result i32))
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
  console.log(wasmSource);
  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return result;
}

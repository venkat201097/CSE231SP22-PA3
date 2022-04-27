
enum Type { Num, Bool, None }

function stringify(typ: Type, arg: any): string {
  switch (typ) {
    case Type.Num:
      return (arg as number).toString();
    case Type.Bool:
      return (arg as boolean) ? "True" : "False";
    case Type.Bool:
      return "None";
  }
}

function print(typ: Type, arg: any): any {
  importObject.output += stringify(typ, arg);
  importObject.output += "\n";
  return arg;
}

export const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: (arg: any) => print(Type.Num, arg),
    print_num: (arg: number) => print(Type.Num, arg),
    print_bool: (arg: number) => print(Type.Bool, arg),
    print_none: (arg: number) => print(Type.None, arg),
    // print: (arg : any, type: number) => {
    //       // console.log("Logging from WASM: ", arg);
    //       // importObject.output = importObject.output + (elt);
    //       var printStmt = "";
    //       switch(type){
    //         case 0:
    //           printStmt = arg
    //           break;
    //         case 1:
    //           if(arg===0)
    //             printStmt = "False";
    //           else
    //             printStmt = "True";
    //         break;
    //         case 2:
    //           throw new Error("Invalid argument;\nExited with error code 1");
    //       }
    //       importObject.output+= printStmt + '\n';
    //       return arg;
    // },
    // runtimeError: () => {
    //   throw new WebAssembly.RuntimeError('RUNTIME ERROR: Operation on None')
    // },
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow
  },
  // js: {
  //   mem: new WebAssembly.Memory({initial:10}),
  // },
  output: '',
};

export type Program<A> = { a?: A, vardefs?: VarDef<A>[], classdefs?: ClassDef<A>[], funcdefs?: FuncDef<A>[], stmts?: Stmt<A>[] }

export type VarDef<A> = { a?: A, name: string, typedef: Type, value: Literal<A> }

export type ClassDef<A> = { a?: A, name: string, fielddefs: VarDef<A>[], methoddefs: FuncDef<A>[]}

export type FuncDef<A> = { a?: A, name: string, args?: TypedVar<A>[], rettype?: Type, body: FuncBody<A> }

export type FuncBody<A> = { a?: A, vardefs?: VarDef<A>[], stmts: Stmt<A>[] }

export type TypedVar<A> = { a?: A, name: string, typedef: Type }

// export type defStmt<A> = 
//   | VarDef<A> | FuncDef<A>


export type Stmt<A> =
  | { a?: A, tag: "assign", lhs: LValue<A>, value: Expr<A> }
  | { a?: A, tag: "if",
      ifcondition?: Expr<A>, body: Stmt<A>[],
      elseblock?: Stmt<A> }
  // | { a?: A, tag: "while",
  //     condition: Expr<A>,
  //     body: Stmt<A>[] }
  | { a?: A, tag: "pass" }
  | { a?: A, tag: "return", expr?: Expr<A> }
  | { a?: A, tag: "expr", expr: Expr<A> }

export type LValue<A> = 
  | { a?: A, tag: "id", name: string}
  | { a?: A, tag: "memberexpr", obj: Expr<A>, field: string}

export type Expr<A> =
  | { a?: A, tag: "literal", value: Literal<A> }
  // | { a?: A, tag: "id", name: string }
  | { a?: A, tag: "unaexpr", op: UnaOp, oprnd: Expr<A> }
  | { a?: A, tag: "binexpr", l_oprnd: Expr<A>, op: BinOp, r_oprnd: Expr<A> }
  | { a?: A, tag: "paranthexpr", expr: Expr<A> }
  // | { a?: A, tag: "memberexpr", obj: Expr<A>, name: string}
  | { a?: A, tag: "call", name: Expr<A>, arglist?: Expr<A>[] }
  | LValue<A>
  | { a?: A, tag: "method", obj: Expr<A>, name: string, arglist?: Expr<A>[]}
export type UnaOp = 
  | { tag: "not"} | { tag: "-"}

export type BinOp = 
  | { tag: "+"} | { tag: "-"} | { tag: "*"} | { tag: "//"}
  | { tag: "%"} | { tag: "=="} | { tag: "!="} | { tag: "<="} 
  | { tag: ">="} | { tag: "<"} | { tag: ">"} | { tag: "is"}

// export type BinOp = "+"|"-"|"*"|"//"|"%"|"=="|"!="|"<="|">="|"<"|">"|"is"


export const binops = new Set(["+", "-","*","//","%","==","!=","<=",">=","<",">","is"])

export function getTypeFromBinOp(op: string) : Type {
  if(op in ["+","-","*","//","%","<=",">=","<",">"])
    return {tag:"int"};
  else if(op in ["==","!="])
    return 
}

export type Literal<A> =
  | { a?: A, tag: "none", value: 0}
  | { a?: A, tag: "boolean", value: number }
  | { a?: A, tag: "number", value: number}

export type Type = { tag:"int" } | { tag: "bool" } | { tag: "none" } | { tag: "object", class: string} | { tag: "any" };

import { assertPrint, assertFail, assertTCFail, assertTC } from "./asserts.test";
import { NUM, BOOL, NONE, CLASS } from "./helpers.test"
describe("My tests", () => {
  assertTC("tc-prog-return-int-basic", `
  x : int = 1
  x`, NUM);

  assertTC("tc-prog-return-bool-basic", `
  x : bool = True
  x`, BOOL);

  assertTC("tc-prog-return-none-basic", `
  x : int = 2
  print(x)`, NONE);

  assertTC("tc-prog-return-object-basic", `
  class A(object):
    i:int = 7
    def __init__(self:A)->A:
      self.i = 9
      return self
  i:A = None
  i = A()
  i
  `, CLASS);
})

describe("TYPE ERRORS", () => {
  assertTCFail("tc-vardef_int_none", `x : int = None`);
  assertTCFail("tc-vardef_int_bool", `x : int = True`);
  assertTCFail("tc-vardef_bool_none", `x : bool = None`);
  assertTCFail("tc-vardef_bool_int", `x : bool = 4`);

  assertTCFail("tc-vardef_obj_int", `
  class A(object):
    x : int = 8
    def __init__(self:A)->A:
      return self
  x:A=3`);
  assertTCFail("tc-vardef_obj_bool", `
  class A(object):
    x : int = 8
    def __init__(self:A)->A:
      return self
  x:A=3`);

  assertTCFail("tc-assign_int_none", `
  x:int = 3
  x = print(x)`)
  assertTCFail("tc-assign_int_bool", `
  x:int = 9
  x = x>10`)
  assertTCFail("tc_assign_int_obj", `
  x:int = 0
  class A(object):
    j:int = 0
  x = A()`)

  assertTCFail("tc-assign_bool_none", `
  x:bool = True
  x = print(x)`)
  assertTCFail("tc-assign_bool_int", `
  x:bool = False
  x = 1//3`)
  assertTCFail("tc_assign_bool_obj", `
  x:bool = False
  class A(object):
    j:int = 0
  x = A()`)

  assertTCFail("not-a-var", `
  a:int=8
  a=i`)
  
  assertTCFail("init-no-args", `
  class A(object):
    def f():
        return`)
})
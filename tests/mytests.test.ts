import { assertPrint, assertFail, assertTCFail, assertTC } from "./asserts.test";
import { NUM, BOOL, NONE, CLASS } from "./helpers.test"
describe("My tests", () => {

  assertPrint("print-obj-is-obj",`
  class A(object):
    i:int=3

  class B(object):
    i:int = 3

  a:A = None
  a1:A = None
  b:B = None
  b1:B = None
  print(a is None)
  print(b is None)
  print(a is b)
  a = A()
  b = B()
  a1 = A()
  b1 = B()
  print(a is b)
  print(a is a1)
  print(b is b1)`,['True','True','True','False', 'False','False'])


  assertPrint("call-init",`
  class A(object):
    def __init__(self:A):
        print(9)
  A()`, ['9'])

  assertPrint("print-obj-is-obj-2",`
  class A(object):
    def f(self:A):
        return

  class B(object):
    def f(self:B):
        return

  a:A = None
  a1:A = None
  b:B = None
  b1:B = None
  print(a is None)
  print(b is None)
  print(a is b)
  a = A()
  b = B()
  a1 = A()
  b1 = B()
  print(a is b)
  print(a is a1)
  print(b is b1)`,['True','True','True','False', 'False','False'])

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
    def __init__(self:A):
      self.i = 9
  i:A = None
  i = A()
  i
  `, CLASS);

  assertTC("tc-if-return-else-return-noreturn", `
  class A(object):
    def f(self:A)->int:
        if True:
            return 3
        else:
            return 3+9
  A().f()`, NUM);

  assertTC("tc-if-return-else-noreturn-return", `
  class A(object):
    def f(self:A)->bool:
        if 9*4<=0:
            return True
        else:
            False
        return False
  A().f()`, BOOL);

  assertTC("tc-if-noreturn-else-return-return", `
  class A(object):
    def f(self:A)->bool:
        if True==not True:
            True
        else:
            return False
        return True
  A().f()`, BOOL);

  assertTC("tc-if-noreturn-else-noreturn-return", `
  class A(object):
    def f(self:A)->int:
        if 5//4==0:
            4
        else:
            6
        return 4*6
  A().f()`, NUM);

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
  
//   assertTCFail("init-no-args", `
//   class A(object):
//     def f():
//         return`)
//   assertTCFail("if-return-noreturn", `
//   class A(object):
//     def f(self:A)->int:
//         if 3==5:
//             return 4
//   A().f()`)
  assertTCFail("if-return-else-noreturn-noreturn", `
  class A(object):
    def f(self:A)->int:
        if 3>0:
            return 4
        else:
            2-3
  A().f()`)
  assertTCFail("if-noreturn-else-return-noreturn", `
  class A(object):
    def f(self:A)->int:
        if 3<9:
            pass
        else:
            return 9
  A().f()`)

  assertTCFail("if-noreturn-else-noreturn-noreturn", `
  class A(object):
    def f(self:A)->int:
        if 3%3<=9:
            pass
        else:
            3-4
  A().f()`)

  assertTCFail("arity-error-0-1", `
  class A(object):
    def f(self:A)->int:
        return 2
  A().f(2)`)

  assertTCFail("arity-error-0-2", `
  class A(object):
    def f(self:A)->int:
        return 2
  A().f(2,A())`)

  assertTCFail("arity-error-1-0", `
  class A(object):
    def f(self:A, i:int)->int:
        return 2
  A().f()`)
  assertTCFail("arity-error-2-0", `
  class A(object):
    def f(self:A, i:int, b:A)->int:
        return 2
  A().f()`)

  assertTCFail("arity-error-n-m<n", `
  class A(object):
    def f(self:A, i:int,b:A)->int:
        return 2
  A().f(A())`)

  assertTCFail("arity-error-n-m>n", `
  class A(object):
    def f(self:A, i:int,b:A)->int:
        return 2
  A().f(A(), A(), A())`)

  assertTCFail("arity-type-error-0-1", `
  class A(object):
    def f(self:A, i:int,b:A)->int:
        return 2
  A().f(A(), A())`)

  assertTCFail("arity-type-error-1-0", `
  class A(object):
    def f(self:A, i:int,b:A)->int:
        return 2
  A().f(5, 5)`)

  assertTCFail("arity-type-error-0-0", `
  class A(object):
    def f(self:A, i:int,b:A)->int:
        return 2
  A().f(A(), 9)`)

  assertTCFail("constructor-args", `
  class A(object):
    i:int=9
  A(3)`)

  assertTCFail("init-args",`
  class A(object):
    def __init__(self:A)->int:
        return 4
  A()`)

  assertTCFail("obj-eq-obj",`
  class A(object):
    def f(self:A):
        return

  class B(object):
    def f(self:B):
        return

  a:A = None
  a1:A = None
  b:B = None
  b1:B = None
  a = A()
  b = B()
  a1 = A()
  b1 = B()
  print(a==a)`)

//   assertTCFail("constructor-args", `
//   class A(object):
//     def f(self:A):
//         if True:
//             pass
//         elif:
//             pass
//         else:
//             lol
//   A(3)`)
})
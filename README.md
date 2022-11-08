# ChocoPy compiler - Classes

Language Specification - 

<code>program := &lt;var_def | func_def&gt;<sup>*</sup> &lt;stmt&gt;<sup>*</sup>
var_def := &lt;typed_var&gt; = &lt;literal&gt;
typed_var := &lt;name&gt; : &lt;type&gt;
func_def := def &lt;name&gt;([&lt;typed_var&gt; [, &lt;typed_var&gt;]<sup>*</sup>]<sup>?</sup>) [-&gt; &lt;type&gt;]<sup>?</sup> : &lt;func_body&gt;
func_body := &lt;var_def&gt;<sup>*</sup> &lt;stmt&gt;<sup>+</sup>
stmt := &lt;name&gt; = &lt;expr&gt;
      | if &lt;expr&gt;: &lt;stmt&gt;<sup>+</sup> [elif &lt;expr&gt;: &lt;stmt&gt;<sup>+</sup>]<sup>?</sup> [else: &lt;stmt&gt;<sup>+</sup>]<sup>?</sup>
      | while &lt;expr&gt;: &lt;stmt&gt;<sup>+</sup>
      | pass
      | return &lt;expr&gt;<sup>?</sup>
      | &lt;expr&gt;
expr := &lt;literal&gt;
      | &lt;name&gt;
      | &lt;uniop&gt; &lt;expr&gt;
      | &lt;expr&gt; &lt;binop&gt; &lt;expr&gt;
      | ( &lt;expr&gt; )
      | &lt;name&gt;([&lt;expr&gt; [, &lt;expr&gt;]<sup>*</sup>]<sup>?</sup>)
uniop := not | -
binop := + | - | * | // | % | == | != | &lt;= | &gt;= | &lt; | &gt; | is                 
literal := None
         | True
         | False
         | &lt;number&gt;
type := int | bool
number := 32-bit integer literals</code>

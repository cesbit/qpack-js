QPack JavaScript
================

Library for encoding and decoding QPack data using pure JavaScript.

Usage example:
```javascript
var data = {
  name: 'Iris',
  age: 3
}

// encode iris to a qp binary string
var qp = qpack.encode(data, true);

// decode qp binary string to JavaScript object.
var iris = qp.decode(qp);

console.log(iris); // {name: 'Iris', age: 3}
```

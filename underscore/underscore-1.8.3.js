//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  // 保存原来的`_`变量
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  // 缓存常用的原型，节省min版本的空间（混淆成短变量名）
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  // 缓存常用数组、对象方法
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  // 缓存原生的ES5方法，这些方法会被优先使用
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  // 空构造函数，用于实现继承
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  // apply与call性能：https://jsperf.com/call-apply-segu
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    // null，返回默认迭代器（返回参数原值）
    if (value == null) return _.identity;
    // 函数，返回一个优化后的cb
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    // 对象，返回一个_.matcher()生成的迭代器（匹配参数所有的键/值）
    if (_.isObject(value)) return _.matcher(value);
    // 字符串、数值，返回一个取属性的函数
    return _.property(value);
  };

  // 根据value不同类型的值，生成迭代器
  // 详见函数cb中的注释
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  // 继承原型，返回新对象
  // 使用Object.create或传统的原型链继承
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  // 生成一个取对象属性的函数
  // 文档中的例子：
  // var stooge = {name: 'moe'};
  // _.property('name')(stooge); // moe
  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  // 根据有无length属性判断是否是类数组对象
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        // iteratee参数：value, index, collection
        // 类数组对象，直接使用索引取值
        // 这样导致有length属性的对象{a:1,length:100}遍历时取不到值
        iteratee(obj[i], i, obj);
      }
    } else {
      // 取实例属性遍历
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    // _.map的迭代器参数使用cb包装，可接收多种参数，返回不同的值
    // _.each的迭代器参数只用optimizeCb包装，因为each不返回值，要的是执行过程，函数以外的参数没有意义
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);

    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      
      // 使用results[index]而不适用results.push()
      // 实测chrome下：
      // bar=new Array(10000000);for(var i=0;i<10000000;i++) {bar[i]=i};
      // 性能优于
      // for(var i=0;i<10000000;i++) {foo.push(i)};
      // 
      // 会传给遍历器3个参数，如果以_.first等函数作为遍历器，第3个参数guard会发挥作用
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  // @param dir 计算方向
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    //
    // 参数：需要reduce的对象、计算规则、属性列表、开始的索引、循环的长度
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          // 根据方向计算开始循环的位置
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      // 如果没有传memo（初始值），就取第一个索引或属性作为memo，然后把索引往前进一位
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  // 先找索引或属性，再取值
  // @param predicate 谓词函数/判定函数，返回布尔值
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    // _.each遍历
    _.each(obj, function(value, index, list) {
      // 满足谓词函数的项push到results
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  // 与_.filter相反，返回所有不满足谓词函数的项
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    // 如果不是类数组，取属性列表
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    // 按index遍历
    for (var index = 0; index < length; index++) {
      // 取属性（不是类数组对象）或索引
      var currentKey = keys ? keys[index] : index;
      // 如果某项不满足谓词函数，直接return false
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    // 所有项都通过谓词函数，走到这里
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  // 实现和_.every基本一样
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      // 有某项满足谓词函数，直接return true
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    // 所有项都不满足谓词函数，走到这里
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  // @todo guard参数？
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    // fromIndex没传数值时置为0我能理解
    // guard为真时置为0有什么作用？内部并没有使用guard的调用，文档中也只说接收3个参数
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    // 接收后续的参数作为调用method的参数
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      // 可以传方法，也可以传属性
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };


  // Convenience version of a common use case of `map`: fetching a property.
  // map的常用场景
  // 抓取对象数组中指定的属性值
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  // filter的常用场景
  // 取对象数组中包含指定键值对的对象
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  // find的常用场景
  // 与_.where类似，但返回的是第一个包含指定键值对的对象
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    // 没有传迭代器，直接比较数组的项 或 对象的所有属性值
    if (iteratee == null && obj != null) {
      // 如果是对象，取对象属性值数组
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } 
    // 传了迭代器，则先用迭代器计算每一项的值
    else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        // 得出计算值比较
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  // _.min的代码结构、逻辑和_.max是一样的
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // 一个经典的洗牌算法
  // 循环整个集合，将当前索引项与当前索引项之前的随机一项交换位置
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      // 0~当前索引随机一个位置
      rand = _.random(0, index);
      // 随机项赋给当前索引
      if (rand !== index) shuffled[index] = shuffled[rand];
      // 当前项赋给随机索引
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  // 从集合中随机取值
  // @param n {Number} 取值个数
  // @todo guard?
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      // 未指定取值个数，取一个
      return obj[_.random(obj.length - 1)];
    }
    // 打乱集合，取前n项
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  // 排序
  // 第1步：map出一个新数组供排序用，包括值value，索引index，排序规则生成的值criteria
  // 第2步：根据criteria和index排序
  // 第3步：摘出value
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        // 原有项
        value: value,
        // 索引（排序用）
        index: index,
        // 根据传入的迭代器（即对值的处理规则）生成的新的值
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      // 按criteria排序
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      // 值相同，按index索引位置排序，即保持原有位置
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  // @param behavior {Function} 一个行为函数，定义如何根据聚合key把value放入结果集。
  // 可以参见_.groupBy，_.indexBy，_.countBy的调用方式
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        // 根据聚合规则生成一个key
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  //
  // 为每个聚合key分配一个数组，保留聚合到这个key的所有值
  // _.groupBy([1.3, 2.1, 2.4], function(num){ return Math.floor(num); });
  // => {1: [1.3], 2: [2.1, 2.4]}
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  //
  // 为每个聚合key分配一个值，所以只能保留聚合到这个key的最后一个对象
  // _.indexBy([1.3, 2.1, 2.4], function(num){ return Math.floor(num); });
  // => {1: 1.3, 2: 2.4}
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  // 
  // 计算每个聚合key值的个数
  // _.countBy([1.3, 2.1, 2.4], function(num){ return Math.floor(num); });
  // => {1: 1, 2: 2}
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  // 创建一个真数组
  // @param obj {Object} 接收数组、类数组对象、对象
  _.toArray = function(obj) {
    if (!obj) return [];
    // 数组，直接返回一个拷贝
    if (_.isArray(obj)) return slice.call(obj);
    // 类数组对象，map出一个数组
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    // 对象，取每个属性的值组成数组
    return _.values(obj);
  };

  // Return the number of elements in an object.
  // 求数组长度
  _.size = function(obj) {
    if (obj == null) return 0;
    // 返回length值或对象属性个数
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  // 根据判定函数分割数组
  // @return {Array} [[通过判定函数的项],[未通过判定函数的项]]
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      // 这个表达式可以
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  // 取数组的前n个元素（默认取1个）
  // guard的作用：
  // _.map([ [1, 2, 3], [4, 5, 6] ], _.first)
  // => [1, 4]
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  // 取数组除后n个元素外的所有元素
  _.initial = function(array, n, guard) {
    // 虽然slice可以接收负数，
    // 但对于_.initial，传一个大于数组长度的n是没有意义的
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  // 取数组后n个元素
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  // 取数组除了前n个元素外的所有元素
  // 被打脸了，这里为啥不Math.max()一下
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  // 过滤掉数组中所有值为false的元素
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  /**
   * 数组扁平化处理
   * @param {Array} input 待处理数组
   * @param {Boolean} shallow 是否浅扁平 如果传true进来，就只处理第一层级了
   * @param {Boolean} strict 是否过滤非数组元素
   * @param {Number} startIndex 起始操作位置
   * 
   * 再单独解释一下strict这个参数
   * 这个参数字面意思是严格模式，表示是否过滤掉非数组的元素（严格要求每一项必须是数组）
   * 如果是深度扁平，扁平到底每一项一定是非数组，这时候strict传true是没有意义的，最终结果会返回一个空数组
   * 如果只扁平一层（shallow传true），这时候strict传true，效果就是把单个元素过滤掉，只扁数组元素
   * 
   * flatten([1,[2,[3]]])
   * => [1, 2, 3] // 深扁平
   * flatten([1,[2,[3]]],true)
   * => [1, 2, [3]] // 浅扁平
   * flatten([1,[2,[3]]], false, true)
   * => [] // 深扁平并过滤非数组元素，只能是[]
   * flatten([1,[2,[3]]], true, true)
   * => [2, [3]] // 浅扁平过滤非数组元素，1被过滤掉了
   */
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        // @todo 为啥需要计算length，性能？待测试
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } 
      // 走到else这里是value不是数组的情况
      // 如果这里strict是true，就不会执行这个赋值操作，
      // 也就是最终的结果里不会有这个value，会被过滤掉！
      else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  // 扁平化数组，可控制深浅
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  // 给定一个数组和一组值，返回一个不包含这组值的新数组
  // 和_.difference类似，但接收的参数是值，内部是把参数转成数组调用_.difference
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  /**
   * 数组去重
   * @param {Array} array 待去重数组
   * @param {Boolean} isSorted 数组是否已经排序，针对排序数组会应用更快的算法
   */
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    // isSorted作为可选参数
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          // 如果传了iteratee，就比较iteratee计算值去重
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        // 排序数组，1,1,1,2,3
        // 取第1个元素（!i）和所有不等于前一项的元素（seen !== computed）
        if (!i || seen !== computed) result.push(value);
        // seen保存上一项，便于与下次循环当前项（computed）比较
        seen = computed;
      } 
      // 未排序数组，但有计算规则
      else if (iteratee) {
        // seen缓存去重后的计算值数组，根据计算值判断
        // 原始值还是push到result中
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } 
      // 未排序数组，原始值去重，直接判断原始值
      else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  // 取并集
  // 可以传入任意个数组
  _.union = function() {
    // 这里传给flatten的参数：true, true，浅扁平，严格模式
    // 取的是传入数组的并集，所以扁平化一层就够了
    // 严格模式可以过滤掉arguments中的非数组参数、callee等其他属性
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.

  /**
   * 取交集
   * 可以传入任意个数组
   * @param {Array} array 第一个数组，计算交集遍历第一个数组中的元素比较就可以
   */
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    // 遍历第一个数组中的元素
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      // 如果result结果中已经存在这个元素，就没必要再比较检验了，直接跳下一次循环
      if (_.contains(result, item)) continue;
      // 遍历剩余所有的数组
      // 因为交集需要剩余所有数组都有这个元素才可以
      for (var j = 1; j < argsLength; j++) {
        // 一旦有某个数组没有这一项，那这一项已经不满足了，直接跳出循环
        if (!_.contains(arguments[j], item)) break;
      }
      // 遍历完所有数组时j===argsLength
      // 如果前面break过，条件不满足item不会被推到result中
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  /**
   * 取差集
   * @param {Array} array 第一个数组
   */
  _.difference = function(array) {
    // 不需要操作第1个数组，flatten的第4个参数发挥作用了
    var rest = flatten(arguments, true, true, 1);
    // 选择其余数组中不存在的元素
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  // 
  // 感觉可以理解成一个矩阵，原来的数组取每一行作为一个元素，转换后的数组取每一列作为一个元素
  // _.zip和_.unzip两个方法作用是一样的，接收参数不一样
  // _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
  // => [["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  // 
  // _.unzip([["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]);
  // => [['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]]
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      // 取每一项的索引位置的元素组成一个新数组
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  // 转换成对象
  // 接收两种参数形式：
  // 1.两个数组：keys数组和values数组
  // _.object(['moe', 'larry', 'curly'], [30, 40, 50]);
  // => {moe: 30, larry: 40, curly: 50}
  // 2.一个数组：keys&values作为一个元素
  // _.object([['moe', 30], ['larry', 40], ['curly', 50]]);
  // => {moe: 30, larry: 40, curly: 50}
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        // 传了values数组，取list的每一项作为键，values的每一项作为值
        result[list[i]] = values[i];
      } else {
        // 只传了list数组，取list每一项的第一个元素作为键，第二个元素作为值
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  // 根据方向生成索引查找函数（_.findIndex、_.findLastIndex）
  // 又见到这样的抽象，区别只是遍历方向和起始遍历位置
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      // 包装判定函数
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        // 通过判定函数，返回当前索引
        if (predicate(array[index], index, array)) return index;
      }
      // 所有项都未通过判定，返回-1
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  // 根据规则查找元素的索引，返回第一个满足条件的索引
  _.findIndex = createPredicateIndexFinder(1);
  // 类似_.findIndex，从最后一个元素开始查
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  // 计算给定项插入一个有序数组的位置
  // 接收iteratee作为计算函数
  _.sortedIndex = function(array, obj, iteratee, context) {
    // 生成计算函数
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      // 计算中间项位置
      var mid = Math.floor((low + high) / 2);
      // 如果中间项的值<待插入项的值，取数组后半部分继续循环，否则取前半部分
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  /**
   * 生成查找位置的函数
   * @param {Number} dir 查找方向 1|-1 正向|反向
   * @param {Function} predicateFind 判定函数
   * @param {Function} sortedIndex 
   */
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    /**
     * @param {Number|Boolean} idx 传number时，作为起始查找位置使用，传true时，代表数组是有序的，使用二分法查找
     */
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      // idx传了数值，作为起始数值使用
      if (typeof idx == 'number') {
        // 根据遍历方向dir和起始位置idx计算开始遍历的位置
        if (dir > 0) {
            // 正向，idx为正数 -> 从idx开始遍历
            // 正向，idx为负数 -> 从idx+length开始遍历，即从后往前算idx的绝对值个项，如果idx+length是个负数，就从第一项开始遍历
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            // 反向，idx为正数 -> 从idx+1开始（往前）遍历，如果这个值大于数组长度了，就还是数组长度
            // 反向，idx为负数 -> 从idx+length+1开始（往前）遍历，还是从后往前算idx的绝对值个项
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } 
      // idx为true
      else if (sortedIndex && idx && length) {
        // 调用_.sortedIndex计算item的位置
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      // 如果要查找一个非数值（NaN）
      if (item !== item) {
        // 调用_.findIndex/_.findLastIndex，传入判定函数_.isNaN
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      // 正向从第一项（i）开始遍历
      // 负向从第二项（length-1）开始遍历
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  // 
  /**
   * 生成一个整数数组
   * @param {Number} start 可选参数，起始值，默认为0
   * @param {Number} stop 结束值
   * @param {Number} step 可选参数，间隔，默认为1
   */
  _.range = function(start, stop, step) {
    // 如果只传了一个参数，这个参数会作为stop使用，而start置为0
    // 即生成一个0~start的数组
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    // step默认值为1
    step = step || 1;

    // 计算结果数组的长度
    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    // 循环，给数组赋值
    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    // 直接调用函数，callingContext是window
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    // 作为构造函数使用
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    // 优先使用原生bind方法
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    // _.bind的参数
    var args = slice.call(arguments, 2);
    var bound = function() {
      // arguments为调用时传的参数，调用时放在_.bind的参数后面
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  /**
   * 偏函数
   * @param {Function} func 原始函数
   * @param arguments 填充参数，如果传`_`，代表这个位置的参数不被填充
   * 
   * boundArgs [_, 20]
   * length 2
   * args [ , ]
   * arguments [5]
   * args[0] = arguments[0] = 5, position=1
   */
  _.partial = function(func) {
    // 取参数
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      // boundArgs 调用_.partial传的填充参数
      // arguments 调用偏函数时传的参数
      // args 拼装后的参数
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        // 如果传了`_`，这个位置接收的就是调用偏函数的参数，否则接收的是之前的填充参数
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      // 处理剩余的参数
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  /**
   * 为对象的多个方法绑定上下文
   * @param {Object} obj 需要绑定的上下文
   * @param arguments 后续传入的都是需要绑定的方法
   */
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    // 遍历传入的方法
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  /**
   * 生成一个可以缓存返回值的参数
   * @param {Function} func 原函数
   * @param {Function} hasher 哈希函数，计算缓存key
   * 
   * hasher参数可以省略，默认使用第一个参数作为缓存key
   * 所以如果原函数接收多个参数，不传hasher会有问题
   */
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      // 通过hash函数计算或使用第一个参数作为缓存key
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      // 缓存中没有，调用函数写入缓存
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  /**
   * 延迟执行一个函数
   * @param {Function} func 原函数
   * @param {Number} wait 延迟时间
   * @param arguments 原函数参数
   */
  _.delay = function(func, wait) {
    // 取原函数参数
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  /**
   * 相当于setTimeout(fn, 1)的效果
   * @param {Function} func 原函数
   * @param arguments 原函数参数
   * 
   * 调用_.partial生成偏函数，第一个参数func需要接收，使用_占位，第二个参数wait传1
   */
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  // 接收一个谓词函数，返回一个相反的谓词函数
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  // 生成一个函数，调用到第times次后才会执行
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  // 生成一个函数，只在调用times次前执行，从第times次开始后续的调用只使用times-1次的返回值
  _.before = function(times, func) {
    // 缓存返回值
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      // 解除func引用
      if (times <= 1) func = null;
      // 后续都使用memo作为返回值
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  // 生成一个只能调用一次的函数
  // 文章中的典型场景：
  // var initialize = _.once(createApplication);
  // initialize();
  // initialize();
  // Application is only created once.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  // Object.prototype.propertyIsEnumerable()方法检测属性是否会被for...in枚举
  // 原型上的toString默认是不会被for...in枚举的，但如果定义toString为对象的实例属性，则应该被枚举
  // 所以如果一个对象定义了toString实例属性还无法被for...in枚举的话，就定义为hasEnumBug
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  // 和toString类似的属性
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    // @todo
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  // 取对象的实例属性，优先使用ES5 Object.keys()方法
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    // IE for...in枚举bug
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  // 取对象的所有可枚举属性
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  // 取对象的属性值列表
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  // 检测对象中是否包含某个实例属性
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  // 指定范围内随机一个整数值
  _.random = function(min, max) {
    // 只传一个参数时，默认随机[0, 参数值]
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));
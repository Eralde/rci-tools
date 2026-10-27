Every `Trait`-class except `BaseTrait` must extend BaseTrait.
Otherwise `this` inside constructor of such `Trait`-class
won't have access to properties from `BaseTrait`.

See https://github.com/tannerntannern/ts-mixer#dealing-with-constructors.

The solution proposed by the `ts-mixer` author,
which is to declare special initializer function,
does not work with the `domain/net2` class system in its current state.

# tsbased

tsbased is a cli to get any config from tsconfig/bases repo for your new TypeScript project

To install it, run:

```sh
npm i -g tsbased
```

and run:

```sh
tsbased
```

It would ask you these questions:

- Whether to keep $schema property, that gives meta typings to your json. VSCode does this automatically.
- Whether to keep "name", "description", "_version" and some other fields that are not needed for development itself.
- Whether to remove comments.
- Where to write. Options are "tsconfig.json" in current dir and "stdout".
- Whether to overwrite existing "tsconfig.json" if you chose the option and it exists already. If you won't accept it, then it will write to stdout.

Submissions with improvements or test cases are welcome!

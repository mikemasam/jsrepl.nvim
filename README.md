# About
lua js repl for neovim 

# How to use 
lazyvim installation

```lua
return {
  "mikemasam/jsrepl.nvim",
  config = function()
    require("jsrepl").setup({
      -- preload_files = {
        -- "/absolute/path/to/helpers.js",
        -- "/absolute/path/to/globals.js",
      -- },
    })
  end,
}
```
```
```


# Bindings 

```
<leader>r to run the current line
'<,'>JSRepl to run the current selection 
```

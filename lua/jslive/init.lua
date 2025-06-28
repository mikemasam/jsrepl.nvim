-- Globals = { "vim" }
local M = {}

local repl_job = nil
local output_buf = nil
local output_win = nil
local started = false

function M.preload_js_file(filepath)
  local lines = {}
  local f = io.open(filepath, "r")
  if f then
    for line in f:lines() do
      table.insert(lines, line)
    end
    f:close()
  else
    print("file not found", filepath)
  end

  -- Send lines to the REPL with newlines
  for _, line in ipairs(lines) do
    vim.fn.chansend(repl_job, line .. "\n")
  end
end

function M.open_output()
  if output_buf and vim.api.nvim_buf_is_valid(output_buf) and vim.api.nvim_win_is_valid(output_win) then
    return output_win, output_buf
  end

  output_buf = vim.api.nvim_create_buf(false, true) -- nofile, scratch
  output_win = vim.api.nvim_open_win(output_buf, false, {
    --[[
    relative = "editor",
    width = math.floor(vim.o.columns * 0.5),
    height = math.floor(vim.o.lines * 0.3),
    row = vim.o.lines - math.floor(vim.o.lines * 0.3),
    col = 0,
    style = "minimal",
    --]]
    split = "below",
  })

  vim.api.nvim_buf_set_option(output_buf, "buftype", "nofile")
  vim.api.nvim_buf_set_option(output_buf, "filetype", "javascript")
  vim.api.nvim_win_set_option(output_win, "wrap", true)

  return output_win, output_buf
end

function M.start_repl()
  if repl_job then
    return
  end

  repl_job = vim.fn.jobstart({ "node", "-i" }, {
    stdout_buffered = false,
    on_stdout = function(_, data, _)
      if not data then
        return
      end

      local filtered = {}
      for _, line in ipairs(data) do
        if line ~= "> " and line ~= "... undefined" and line ~= "undefined" and line:match("%S") then
          table.insert(filtered, line)
        end
      end
      -- Append REPL output to output buffer
      -- local lines = vim.split(table.concat(data, "\n"), "\n")
      if #filtered > 0 then
        vim.api.nvim_buf_set_lines(output_buf, -1, -1, false, filtered)
      end
    end,
    on_stderr = function(_, data, _)
      print("error = ", table.concat(data, "\n"))
      if not data then
        return
      end
      local lines = vim.split(table.concat(data, "\n"), "\n")
      vim.api.nvim_buf_set_lines(output_buf, -1, -1, false, lines)
    end,
    on_exit = function()
      print("repl exit = ")
      repl_job = nil
    end,
  })
  if M.opts.preload_files then
    for _, path in ipairs(M.opts.preload_files) do
      M.preload_js_file(path)
    end
  end
end

-- Send code string to REPL
function M.send_code(code)
  if not repl_job then
    M.start_repl()
    vim.defer_fn(function()
      M.send_code(code)
    end, 100) -- wait a bit then send again
    return
  end

  vim.fn.chansend(repl_job, code .. "\n")
end
function M.get_selection()
  local mode = vim.fn.mode()
  local start_pos, end_pos

  if mode == "v" or mode == "V" then
    start_pos = vim.api.nvim_buf_get_mark(0, "<")
    end_pos = vim.api.nvim_buf_get_mark(0, ">")
  else
    -- fallback: current line
    local cur = vim.api.nvim_win_get_cursor(0)
    start_pos = { cur[1], 0 }
    end_pos = { cur[1], 0 }
  end

  local lines = vim.api.nvim_buf_get_lines(0, start_pos[1] - 1, end_pos[1], false)
  return table.concat(lines, "\n")
end

function M.send_selection()
  M.open_output()
  local code = M.get_selection()
  M.send_code(code)
end

function M.setup(opts)
  M.opts = opts or {}
  vim.api.nvim_create_user_command("JSRepl", function()
    M.send_selection()
  end, { range = true })

  -- Optional keymap: <leader>r to send selection
  vim.api.nvim_set_keymap("v", "<leader>r", ":<C-U>JSRepl<CR>", { noremap = true, silent = true })
  vim.api.nvim_set_keymap("n", "<leader>r", ":<C-U>JSRepl<CR>", { noremap = true, silent = true })

  vim.api.nvim_create_autocmd("VimLeavePre", {
    callback = function()
      if repl_job and vim.fn.jobwait({ repl_job }, 0)[1] == -1 then
        vim.fn.jobstop(repl_job)
      end
    end,
  })
end

return M

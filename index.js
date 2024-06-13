module.exports = (plugin) => {
  plugin.setOptions({ dev: false });
  plugin.registerCommand("JSLive", onTask(plugin), {
    sync: false,
    range: "",
  });
  /*
  plugin.registerAutocmd(
    "BufDelete",
    async () => {
      await plugin.nvim.outWrite('JSLive buffer closed\n');
    },
    { sync: false, pattern: "jslive", eval: 'expand("<afile>")' },
  );
  */
};
//'

let output_win = null;
let output_buffer = null;

const util = require("util");

async function init_win(plugin) {
  if (output_win) {
    //await plugin.nvim.outWrite('JSLive buffer closed\n');
    //await runEmitter("Error:", JSON.stringify(output_win));
    //plugin.nvim.command(`buffer ${output_buffer.id}`);
    //if (await output_win.valid) return output_win;
    //output_win?.close?.();
    return output_win;
  }
  output_buffer = await plugin.nvim.createBuffer(false, false);
  output_win = await plugin.nvim.openWindow(output_buffer, false, {
    split: "below",
  });
  await output_win.setOption("filetype", "javascript");
  await plugin.nvim.call("nvim_buf_set_name", [
    output_buffer.id,
    "jslive" + output_buffer.id,
  ]);
  await output_win.setOption("buftype", "nofile");
  await output_win.setOption("modifiable", true);
  await output_win.setOption("relativenumber", false);

  runEmitter = async (type, ...args) =>
    await writeLn(plugin, output_win, type, ...args);
  return output_win;
}
let replServer = null;
const { Readable, Writable } = require("stream");
let runEmitter = null;
let runInject = null;
async function startRelp() {
  if (replServer) return;
  return new Promise((resl) => {
    let writableStream = new Writable({
      write(chunk, _e, callback) {
        const text = chunk.toString();
        if (!text?.length || text == "\n" || text == "undefined\n") {
          callback();
          return;
        }
        runEmitter?.("console:", text);
        callback();
      },
    });
    let readableStream = new Readable({
      read() {
        if (!runInject) {
          this.push(
            "const liverequire = (module_path) => { delete require.cache[require.resolve(module_path)]; return require(module_path);}\n",
          );
          runInject = (lines) => {
            this.push(lines.join("\n") + "\n");
          };
          resl(true);
        }
      },
    });

    const repl = require("node:repl");
    if (!repl) return resl(false);
    replServer = repl.start({
      useGlobal: false,
      prompt: "",
      input: readableStream,
      output: writableStream,
    });
    initContext();
  });
}

const { table, getBorderCharacters } = require("table");
const config = {
  singleLine: true,
  border: getBorderCharacters("ramac"),
};
function flattenData(input) {
  if (typeof input === "object") {
    if (Array.isArray(input)) {
      if (!input.length) return false;
      const headers = Object.keys(input[0]);
      const data = input.map((item) => Object.values(item));
      return [headers, ...data];
    } else {
      const headers = Object.keys(input);
      const data = Object.values(input);
      return [headers, data];
    }
  } else {
    return [[input]];
  }
}
function initContext() {
  const Consola = {
    any(m, ...a) {
      if (m == "table") {
        const t = table ? flattenData(a[0]) : false;
        if(Array.isArray(t)) return runEmitter?.(`${m}:`, table(t, config));
      } 
      runEmitter?.(`${m}:`, ...a);
    },
  };
  const cpx = new Proxy(Consola, {
    get(target, prop) {
      return (...args) => {
        target.any(prop, ...args);
      };
    },
  });

  Object.defineProperty(replServer.context, "console", {
    __proto__: null,
    configurable: true,
    writable: true,
    value: cpx,
  });
}

async function clearOutput(win) {
  await win.buffer.setLines([], { start: 0, end: -1, strictIndexing: false });
  initContext();
}
async function writeLn(plugin, win, type, ...t) {
  try {
    if (type == "console:") {
      if (t[0].indexOf("Clearing") == 0) {
        await clearOutput(win);
        return;
      }
    }
    await Promise.all(
      t.map(async (str) => {
        const output = util.format(str);
        const lines = output.split("\n");
        const last = lines[lines.length - 1];
        if (!last.length) lines.pop();
        await win.buffer.append(lines);
      }),
    );
    const totalLines = await win.buffer.length;
    //await win.setCursor([totalLines - 1, 0]);

    await plugin.nvim.call("nvim_win_set_cursor", [
      win.id,
      [totalLines - 1, 0],
    ]);
  } catch (err) {
    await win.buffer.append([err.toString(), err?.stack.split("\n").join(",")]);
  }
}
function onTask(plugin) {
  return async (...args) => {
    try {
      const range = args[0];
      //await plugin.nvim.buffer.append("Here: " + JSON.stringify(args));
      range[0] -= 1;
      const [startLine, endLine] = range;
      const [lines, win] = await Promise.all([
        plugin.nvim.buffer.getLines({
          start: startLine,
          end: endLine,
          strictIndexing: false,
        }),
        init_win(plugin),
        startRelp(),
      ]);
      await plugin.nvim.feedKeys("\x1b", "n", true);
      runInject?.(lines);
    } catch (err) {
      await runEmitter("Error:", err);
      console.error(err);
    }
  };
}

//NvimPlugin.nvim
//await plugin.nvim.buffer.append(lines);
//await plugin.nvim.attachBuffer(buf);
//plugin.nvim.command(`vert sbx${buf.id}`)
//const buf = new plugin.nvim.Buffer();
//plugin.nvim.outWriteLine("Hi there")
//await nvim.request('nvim_buf_set_option', [newBuffer, 'filetype', 'YOUR_FILETYPE']);
//const w = await plugin.nvim.command('new');
//const newBuffer = await plugin.nvim.request('new', [true, true]);
//await plugin.nvim.buffer.append("w: " + newBuffer?.id);

//buf.append(lines);
//await win.buffer.insert("TypeOf: " + typeof buf, 0);

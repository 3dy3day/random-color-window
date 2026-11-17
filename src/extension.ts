import { execFile } from "child_process";
import { appendFile, mkdir, readFile } from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";
import { chooseRandom, PALETTE, WindowColor } from "./palette";

const COLOR_KEY = "randomColorWindow.color";
const NAME_KEY = "randomColorWindow.colorName";
const OWNER_KEY = "randomColorWindow.ownedThemeKeys";

const SETTINGS_PATH = ".vscode/settings.json";

const run = promisify(execFile);

let status: vscode.StatusBarItem;

// Workspace settings land in .vscode/settings.json. Hide that file through the
// repository-local .git/info/exclude so no project needs a .gitignore entry.
async function excludeSettingsFromGit(): Promise<void> {
  if (vscode.workspace.workspaceFile) return; // Multi-root settings live in the .code-workspace file.
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder?.uri.scheme !== "file") return;
  const cwd = folder.uri.fsPath;
  const succeeds = (...args: string[]) => run("git", args, { cwd }).then(() => true, () => false);

  try {
    // Already ignored, or deliberately committed by the project: leave it alone.
    if (await succeeds("check-ignore", "-q", SETTINGS_PATH)) return;
    if (await succeeds("ls-files", "--error-unmatch", SETTINGS_PATH)) return;

    const [{ stdout: prefix }, { stdout: excludePath }] = await Promise.all([
      run("git", ["rev-parse", "--show-prefix"], { cwd }),
      run("git", ["rev-parse", "--git-path", "info/exclude"], { cwd })
    ]);
    const file = path.resolve(cwd, excludePath.trim());
    const existing = await readFile(file, "utf8").catch(() => "");
    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, `${separator}/${prefix.trim()}${SETTINGS_PATH}\n`);
  } catch {
    // Not a git repository, or git is unavailable.
  }
}

function readableForeground(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? "#1A1A1A" : "#FFFFFF";
}

function themeEntries(color: WindowColor): Record<string, string> {
  const bg = color.value;
  const fg = readableForeground(bg);
  return {
    "window.activeBorder": bg,
    "window.inactiveBorder": bg,
    "titleBar.activeBackground": bg,
    "titleBar.activeForeground": fg,
    "titleBar.inactiveBackground": bg,
    "titleBar.inactiveForeground": `${fg}B3`,
    "activityBar.background": bg,
    "activityBar.foreground": fg,
    "activityBar.inactiveForeground": `${fg}80`,
    "activityBar.activeBorder": fg,
    "activityBarBadge.background": fg,
    "activityBarBadge.foreground": bg,
    "statusBar.background": bg,
    "statusBar.foreground": fg,
    "statusBar.noFolderBackground": bg,
    "statusBarItem.remoteBackground": bg,
    "statusBarItem.remoteForeground": fg,
    "statusBarItem.hoverBackground": `${fg}26`
  };
}

async function writeThemeColor(color: WindowColor): Promise<void> {
  const configuration = vscode.workspace.getConfiguration();
  const current = configuration.get<Record<string, string>>("workbench.colorCustomizations", {});
  const previouslyOwned = configuration.get<string[]>(OWNER_KEY, []);
  const entries = themeEntries(color);
  await excludeSettingsFromGit();

  const next = { ...current };
  for (const key of previouslyOwned) delete next[key];
  Object.assign(next, entries);

  await configuration.update(
    "workbench.colorCustomizations",
    next,
    vscode.ConfigurationTarget.Workspace
  );
  await configuration.update(COLOR_KEY, color.value, vscode.ConfigurationTarget.Workspace);
  await configuration.update(NAME_KEY, color.name, vscode.ConfigurationTarget.Workspace);
  await configuration.update(OWNER_KEY, Object.keys(entries), vscode.ConfigurationTarget.Workspace);
  updateStatus(color);
}

function updateStatus(color?: WindowColor): void {
  if (!color || !vscode.workspace.getConfiguration("randomColorWindow").get("showStatusBar", true)) {
    status.hide();
    return;
  }
  status.text = `$(symbol-color) ${color.name}`;
  status.tooltip = `Window color: ${color.name} (${color.value}) — click to change`;
  status.command = "randomColorWindow.changeColor";
  status.color = readableForeground(color.value);
  status.backgroundColor = new vscode.ThemeColor("statusBarItem.prominentBackground");
  status.show();
}

async function reset(): Promise<void> {
  const configuration = vscode.workspace.getConfiguration();
  const current = configuration.get<Record<string, string>>("workbench.colorCustomizations", {});
  const owned = configuration.get<string[]>(OWNER_KEY, []);
  const next = { ...current };
  for (const key of owned) delete next[key];

  await configuration.update("workbench.colorCustomizations", next, vscode.ConfigurationTarget.Workspace);
  await configuration.update(COLOR_KEY, undefined, vscode.ConfigurationTarget.Workspace);
  await configuration.update(NAME_KEY, undefined, vscode.ConfigurationTarget.Workspace);
  await configuration.update(OWNER_KEY, undefined, vscode.ConfigurationTarget.Workspace);
  status.hide();
}

async function pickColor(): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    PALETTE.map((color) => ({
      label: `$(circle-filled) ${color.name}`,
      description: color.value,
      color
    })),
    { title: "Choose this window's color", placeHolder: "16 preset colors" }
  );
  if (picked) await writeThemeColor(picked.color);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000);
  context.subscriptions.push(
    status,
    vscode.commands.registerCommand("randomColorWindow.changeColor", pickColor),
    vscode.commands.registerCommand("randomColorWindow.randomizeColor", async () => {
      const current = vscode.workspace.getConfiguration().get<string>(COLOR_KEY);
      await writeThemeColor(chooseRandom(current));
    }),
    vscode.commands.registerCommand("randomColorWindow.resetColor", reset),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("randomColorWindow.showStatusBar")) {
        const configuration = vscode.workspace.getConfiguration();
        const value = configuration.get<string>(COLOR_KEY);
        const name = configuration.get<string>(NAME_KEY);
        updateStatus(value && name ? { value, name } : undefined);
      }
    })
  );

  if (!vscode.workspace.getConfiguration("randomColorWindow").get("enabled", true)) return;

  const configuration = vscode.workspace.getConfiguration();
  const value = configuration.get<string>(COLOR_KEY);
  const name = configuration.get<string>(NAME_KEY);
  if (!value || !name) {
    await writeThemeColor(chooseRandom());
    return;
  }

  // Re-apply when an update changes the set of themed keys, so existing
  // workspaces pick up newly colored UI areas without a manual command.
  const owned = configuration.get<string[]>(OWNER_KEY, []);
  const expected = Object.keys(themeEntries({ value, name }));
  const stale = owned.length !== expected.length || expected.some((key) => !owned.includes(key));
  if (stale) await writeThemeColor({ value, name });
  else {
    await excludeSettingsFromGit();
    updateStatus({ value, name });
  }
}

export function deactivate(): void {}

import { io } from "socket.io-client";

async function main() {
  if (Spicetify.LocalStorage.get("socketio:theme")) {
    const { userCSSContent, enabled, schemesContent, name, activeScheme } =
      JSON.parse(Spicetify.LocalStorage.get("socketio:theme")!) as {
        enabled: boolean;
        userCSSContent: string;
        schemesContent: string;
        name: string;
        activeScheme: string;
      };

    if (enabled) {
      injectTheme(userCSSContent, schemesContent, name, activeScheme);

      // @ts-expect-error False positive
      Spicetify.Config.current_theme = name;
      // @ts-expect-error False positive
      Spicetify.Config.color_scheme = activeScheme;
    }
  }

  console.log("Loaded socketio extension");
  const socket = io("ws://localhost:3000", { autoConnect: true });

  socket.connect();

  socket.on("connect", () => {
    console.log("Connected to socketio server");
  });

  socket.on("get-config", () => {
    console.log("Received event get-config");
    socket.emit("get-config", Spicetify.Config);
  });

  Spicetify.Player.addEventListener("songchange", (data) => {
    socket.emit("songchange", JSON.stringify(data));
  });

  socket.on("remove-themes", async () => {
    const existingMarketplaceSchemeCSS = document.querySelector(
      "style.marketplaceCSS.marketplaceScheme",
    );
    if (existingMarketplaceSchemeCSS) existingMarketplaceSchemeCSS.remove();

    const existingMarketplaceThemeCSS = document.querySelector(
      "link.marketplaceCSS",
    );
    if (existingMarketplaceThemeCSS) existingMarketplaceThemeCSS.remove();

    const existingUserThemeCSS = document.querySelector(
      "link[href='user.css']",
    );
    if (existingUserThemeCSS) existingUserThemeCSS.remove();

    const existingMarketplaceUserCSS = document.querySelector(
      "style.marketplaceCSS.marketplaceUserCSS",
    );
    if (existingMarketplaceUserCSS) existingMarketplaceUserCSS.remove();
  });

  socket.on("inject-theme", async (data) => {
    const manifest = JSON.parse(data) as {
      usercss: string;
      schemes: string;
      name: string;
      activeScheme: string;
    };

    console.log("Injecting theme: ", manifest);

    const userCSSContent = await (await fetch(manifest.usercss)).text();
    const schemesContent = await (await fetch(manifest.schemes)).text();

    console.log(userCSSContent);
    console.log(schemesContent);

    Spicetify.LocalStorage.set(
      "socketio:theme",
      JSON.stringify({
        enabled: true,
        userCSSContent: userCSSContent,
        schemesContent: schemesContent,
        name: manifest.name,
        activeScheme: manifest.activeScheme,
      }),
    );

    injectTheme(
      userCSSContent,
      schemesContent,
      manifest.name,
      manifest.activeScheme,
    );
  });
}

function injectTheme(
  userCSSContent: string,
  schemesContent: string,
  themeName: string,
  activeScheme: string,
) {
  const parsedSchemes = parseIni(schemesContent);

  console.log(parsedSchemes);

  const existingMarketplaceSchemeCSS = document.querySelector(
    "style.marketplaceCSS.marketplaceScheme",
  );
  if (existingMarketplaceSchemeCSS) existingMarketplaceSchemeCSS.remove();

  const schemeTag = document.createElement("style");
  schemeTag.classList.add("marketplaceCSS");
  schemeTag.classList.add("marketplaceScheme");

  let injectStr = ":root {";
  const themeIniKeys = Object.keys(parsedSchemes[activeScheme]);
  for (const key of themeIniKeys) {
    console.log(key);
    injectStr += `--spice-${key}: #${parsedSchemes[activeScheme][key]};`;
    injectStr += `--spice-rgb-${key}: ${hexToRGB(parsedSchemes[activeScheme][key])};`;
  }
  injectStr += "}";

  schemeTag.innerHTML = injectStr;

  console.log(injectStr);

  const headEl = document.querySelector("head") as HTMLElement;
  document.body.appendChild(schemeTag);

  // @ts-expect-error: `color_scheme` is read-only type in types
  Spicetify.Config.color_scheme = activeScheme;

  const existingMarketplaceThemeCSS = document.querySelector(
    "link.marketplaceCSS",
  );
  if (existingMarketplaceThemeCSS) existingMarketplaceThemeCSS.remove();

  try {
    const existingUserThemeCSS = document.querySelector(
      "link[href='user.css']",
    );
    if (existingUserThemeCSS) existingUserThemeCSS.remove();

    const existingMarketplaceUserCSS = document.querySelector(
      "style.marketplaceCSS.marketplaceUserCSS",
    );
    if (existingMarketplaceUserCSS) existingMarketplaceUserCSS.remove();

    console.log(headEl);

    console.log(userCSSContent);

    const userCssTag = document.createElement("style");
    userCssTag.classList.add("marketplaceCSS");
    userCssTag.classList.add("marketplaceUserCSS");
    userCssTag.innerHTML = userCSSContent;
    document.body.appendChild(userCssTag);
  } catch (error) {
    console.warn(error);
  }

  // @ts-expect-error: `current_theme` is read-only type in types
  Spicetify.Config.current_theme = themeName;
}

function parseIni(data: string): SchemeIni {
  const regex = {
    section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
    param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/,
  };
  const value: SchemeIni = {};
  const lines = data.split(/[\r\n]+/);
  let section: string | null = null;

  for (const line of lines) {
    if (regex.comment.test(line)) {
      continue;
    }

    if (regex.param.test(line)) {
      if (line.includes("xrdb")) {
        continue;
      }

      const match = line.match(regex.param);
      if (section && match && match.length === 3) {
        const key = match[1].trim();
        const val = match[2].split(";")[0].trim();
        if (!value[section]) {
          value[section] = {};
        }
        value[section][key] = val;
      }
    } else if (regex.section.test(line)) {
      const match = line.match(regex.section);
      if (match) {
        section = match[1];
        value[section] = {};
      }
    }
  }
  return value;
}

type ColourScheme = {
  [key: string]: string;
};

type SchemeIni = {
  [key: string]: ColourScheme;
};

function hexToRGB(inputHex?: string) {
  if (!inputHex) {
    return "";
  }

  const hex =
    inputHex.length === 3
      ? inputHex
        .split("")
        .map((char) => char + char)
        .join("")
      : inputHex;

  const aRgbHex = hex.match(/.{1,2}/g);
  if (!aRgbHex || aRgbHex.length !== 3) {
    throw "Could not parse hex colour.";
  }

  const aRgb = [
    Number.parseInt(aRgbHex[0], 16),
    Number.parseInt(aRgbHex[1], 16),
    Number.parseInt(aRgbHex[2], 16),
  ];

  return aRgb;
}

export default main;

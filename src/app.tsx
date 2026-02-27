import { io } from "socket.io-client";

async function main() {
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

  socket.on("inject-theme", async (data) => {
    const manifest = JSON.parse(data) as {
      usercss: string;
      schemes: string;
      name: string;
    };

    console.log("Injecting theme: ", manifest);

    const userCSSContent = await (await fetch(manifest.usercss)).text();
    const schemesContent = await (await fetch(manifest.schemes)).text();

    console.log(userCSSContent);
    console.log(schemesContent);

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
    const themeIniKeys = Object.keys(parsedSchemes["main"]);
    for (const key of themeIniKeys) {
      console.log(key);
      injectStr += `--spice-${key}: #${parsedSchemes["main"][key]};`;
      injectStr += `--spice-rgb-${key}: ${hexToRGB(parsedSchemes["main"][key])};`;
    }
    injectStr += "}";
    schemeTag.innerHTML = injectStr;
    document.body.appendChild(schemeTag);

    // @ts-expect-error: `color_scheme` is read-only type in types
    Spicetify.Config.color_scheme = "main";

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

      if (userCSSContent) {
        const userCssTag = document.createElement("style");
        userCssTag.classList.add("marketplaceCSS");
        userCssTag.classList.add("marketplaceUserCSS");
        userCssTag.innerHTML = userCSSContent;
        document.body.appendChild(userCssTag);
      } else {
        const originalUserThemeCSS = document.createElement("link");
        originalUserThemeCSS.setAttribute("rel", "stylesheet");
        originalUserThemeCSS.setAttribute("href", "user.css");
        originalUserThemeCSS.classList.add("userCSS");
        document.body.appendChild(originalUserThemeCSS);
      }
    } catch (error) {
      console.warn(error);
    }

    // @ts-expect-error: `current_theme` is read-only type in types
    Spicetify.Config.current_theme = "main";
  });
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
      continue; // Skip comment lines
    }

    if (regex.param.test(line)) {
      // Check for xrdb
      if (line.includes("xrdb")) {
        continue; // Skip xrdb lines
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
  console.log(inputHex);
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

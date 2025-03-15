#!/usr/bin/env -S node

import { confirm, select } from "@inquirer/prompts";
import redaxios from "redaxios";
import fs from "fs";
import { stdout } from "process";

class Logger {
  info(...args) {
    console.log(...args);
  }
  error(...args) {
    console.error(...args);
  }
  warn(...args) {
    console.warn(...args);
  }
}

const l = new Logger();

const client = redaxios.create({
  baseURL: "https://api.github.com",
});

/**
 * @typedef RepoFile
 *
 * @prop {string} name
 * @prop {string} sha
 */

/**
 * @typedef ConfigFile
 *
 * @prop {string} content
 * @prop {string} encoding
 *
 */

/** @returns {Promise<Array<RepoFile>>} */
const getFiles = async () => {
  return client.get("/repos/tsconfig/bases/contents/bases").then((r) => r.data);
};

/**
 * @param {string} file
 *  @returns {Promise<ConfigFile>} */
const getFile = async (file) => {
  return client
    .get(`/repos/tsconfig/bases/contents/bases/${file}`)
    .then((r) => r.data);
};

const fieldsToRemove = ["display", "name", "_version", "docs"];

async function main() {
  const getFilesPromise = getFiles();

  l.info("Hello, let's configure tsbase you're getting.");
  const removeDescName = await confirm({
    message: `Want to remove unnecessary fields? (${fieldsToRemove.join(
      ", "
    )})`,
  });
  const keepSchemaReferenceUrl = await confirm({
    message: "Want to keep $schema url?",
  });
  const wantRemoveComments = await confirm({
    message: "Want to remove all comments?",
  });
  const writeTo = await select({
    message: "Where should we write output?",
    choices: [
      {
        name: "tsconfig",
        value: "tsconfig",
        description: "To tsconfig.json in current dir",
      },
      {
        name: "stdout",
        value: "stdout",
        description: "To stdout",
      },
    ],
  });

  const wouldOverwriteFile =
    writeTo === "tsconfig" && fs.existsSync("./tsconfig.json")
      ? await confirm({
          message: "Would you want to overwrite tsconfig? DANGEROUS!",
          default: false,
        })
      : true;

  const config = {
    removeDescName,
    keepSchema: keepSchemaReferenceUrl,
    writeTo,
    wouldOverwriteFile,
    wantRemoveComments,
  };

  const files = await getFilesPromise.catch((e) => {
    l.error("Error from getFiles API", e);
    process.exit(1);
  });

  const selectedFileName = await select({
    message: "What file do you want?",
    choices: files.map((f) => ({
      name: f.name,
      value: f.name,
    })),
  });

  l.info(`Ok. Getting ${selectedFileName}`);

  const file = await getFile(selectedFileName).catch((e) => {
    l.error("Error from getFile API", e);
    process.exit(1);
  });

  l.info("Got file, writing...");

  try {
    let commentJson;

    const getJson = async () => {
      const parsed = Buffer.from(file.content, file.encoding).toString();

      if (config.wantRemoveComments) {
        const lines = [];
        for (const line of parsed.split("\n")) {
          if (line.trim().startsWith("//")) continue;
          lines.push(line);
        }

        const json = JSON.parse(lines.join("\n"));
        return json;
      }

      commentJson = await import("comment-json").catch((e) => {
        l.error("error importing comment-json lib", e);
        process.exit(1);
      });

      return commentJson.parse(parsed);
    };

    const json = await getJson();

    if (!config.keepSchema) {
      delete json["$schema"];
    }
    if (config.removeDescName) {
      for (const field of fieldsToRemove) {
        delete config[field];
      }
    }

    const stringifyJson = async (json) => {
      if (config.wantRemoveComments) return JSON.stringify(json, null, 2);

      if (!commentJson) {
        commentJson = await import("comment-json");
      }

      return commentJson.stringify(json, null, 2);
    };

    switch (config.writeTo) {
      case "tsconfig": {
        if (config.wouldOverwriteFile) {
          fs.writeFileSync("./tsconfig.json", await stringifyJson(json));
        } else {
          const useStdout = await confirm(
            "You decided to not overwrite tsconfig. Still want to print to stdout?"
          );

          if (!useStdout) {
            l.info("Okay. Exiting.");
            process.exit(0);
          }

          stdout.write((await stringifyJson(json)) + "\n");
        }
        break;
      }
      case "stdout": {
        stdout.write((await stringifyJson(json)) + "\n");
        break;
      }
      default: {
        l.info("no destination found, exiting...");
        process.exit(1);
      }
    }

    l.info("Done!");
  } catch (error) {
    l.error("Error writing, ", error);
    process.exit(1);
  }
}

main();

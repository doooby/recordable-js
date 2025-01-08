import alias from "@rollup/plugin-alias"
import typescript from "rollup-plugin-typescript2"
import { fileURLToPath } from 'url';
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
    input: "./mod.ts",
    output: {
        file: "dist/rdb.esm.js",
        format: "esm",
        sourcemap: true,
    },
    plugins: [
        alias({
            entries: [
                { find: "@rdb", replacement: path.resolve(__dirname, "./motd.ts") },
            ],
        }),
        typescript({
          // exclude: ['src/types.ts'],
          tsconfigOverride: {
            compilerOptions: {
              baseUrl: "./",
              paths: {
                "@rdb": ["mod.ts"]
              },
              module: "esnext",
              target: "esnext",
              // esModuleInterop: true,
              allowImportingTsExtensions: true,
              emitDeclarationOnly: true,
              declaration: true,
            },
          },
        }),
    ],
}

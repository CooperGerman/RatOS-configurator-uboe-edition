# RatOS Configurator

This is the repository for the [RatOS](os.ratrig.com) configurator - a 3d printer provisioning application for RatOS with config generation, board identification, provisioning and automatic flashing. 

## Contributing

All non-hotfix pull requests (meaning additions, enhancements and features) should be submitted against the `development` branch.
Bug fixes should be submitted against the v2.x branch and subseqently merged into `development`.

## Local setup

### Requirements

This thing still need to be dockerized (PR's welcome), but will run on any linux based machine with the following prerequisites:

* Linux or WSL
* VSCode
* Node v20.x (i prefer managing this with [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating))
* [PNPM](https://pnpm.io/installation)

Most bash scripts will assume user `pi` exists. Needs fixing, fortunately  you don't need them for most work.

### Installation

The `RatOS-configuration` has been incorporated into `RatOS-configurator` (the so-called "monorepo" update), so the `RatOS-configuration` repo is no longer used and should not be cloned. The correct development environment installation process for the monorepo setup is not fully documented yet.

Clone repositories
```bash
mkdir RatOS-dev && cd RatOS-dev
mkdir -p printer_data/ratos
mkdir -p printer_data/logs
mkdir -p printer_data/config
git clone git@github.com:Rat-OS/RatOS-configurator.git
# External dependencies
git clone git@github.com:klipper3d/klipper.git
git clone git@github.com:Arksine/moonraker.git
# Configuration repo ** SEE MONOREPO NOTE ABOVE **
ln -s /home/myuser/RatOS-dev/RatOS-configurator/configuration /home/myuser/RatOS-dev/printer_data/config/RatOS
#cd printer_data/config
#git clone git@github.com:Rat-OS/RatOS-configuration.git RatOS
#cd ../..
```

Install dependencies
```bash
cd RatOS-configurator/src
pnpm install
```

Copy environment constants and define paths in .env.local
```bash
cp .env .env.local
cd ..
# Start vscode
code .
```

Edit .env.local and modify the paths to match your setup ie:
```
RATOS_CONFIGURATION_PATH=/home/myuser/RatOS-dev/printer_data/config/RatOS
KLIPPER_CONFIG_PATH=/home/myuser/RatOS-dev/printer_data/config
RATOS_SCRIPT_DIR=/home/myuser/RatOS-dev/RatOS-configurator/src/scripts
KLIPPER_DIR=/home/myuser/RatOS-dev/klipper
KLIPPER_ENV=/home/myuser/RatOS-dev/klippy-env
MOONRAKER_DIR=/home/myuser/RatOS-dev/moonraker
LOG_FILE=/home/myuser/RatOS-dev/printer_data/logs/ratos-configurator.log
RATOS_DATA_DIR=/home/myuser/RatOS-dev/printer_data/ratos
NEXT_PUBLIC_KLIPPER_HOSTNAME=hostnameofrunningtestprinter.local
RECOIL_DUPLICATE_ATOM_KEY_CHECKING_ENABLED=false
```
NOTE: for modern monorepo setups, the following change to the above is at least partially functional:
```
RATOS_CONFIGURATION_PATH=/home/myuser/RatOS-dev/RatOS-configurator/configuration
```

It may also be necessary to create .env.test.local:
```bash
cd RatOS-configurator/src
cp .env.local .env.test.local
```

The `NEXT_PUBLIC_KLIPPER_HOSTNAME` variable is used by the frontend to connect to moonraker and klipper, those need to be real. The RatOS configurator will save configuration to the database on the moonraker instance running on that host.

You can try and run klipper and moonraker locally (i have not gone down this path yet).

### (Optional) link the RatOS cli binary (commands only work when dev server is running)
```bash
sudo ln -s "/home/myuser/RatOS-dev/RatOS-configurator/src/bin/ratos" "/usr/local/bin/ratos"
sudo chmod a+x "/usr/local/bin/ratos"
```
You should no be able to run the `ratos` cli command.

### Developing

in `RatOS-dev/RatOS-configurator/src` you can run

* `pnpm run dev` to run the development server
* `pnpm run test` to run the tests
* `pnpm run typecheck` to run typechecking
* `pnpm run lint` to run linting

### Testing Deployments with Deployment Branches

RatOS-Configurator currently uses deployment branches to release and publish
the compiled RatOS-configurator app. There is a utility script
at `./scripts/create-local-deployment.sh` that will automatically
create a local deployment branch derived from you current working branch
and directory.

The script can be run from any directory in the RatOS-configurator repo, and **it will create a new directory
in the RatOS-Configurator's parent directory**

```console
cd /path/to/RatOS-configurator
./scripts/create-local-deployment.sh
```

<details>
<summary>Example Output</summary>

```console
./scripts/create-local-deployment.sh
./scripts/create-local-deployment.sh: line 118: is_cmd: command not found
Preparing worktree (new branch 'local-deploy-branch-automation-deployment')
HEAD is now at 5e4cf175f fix: don't escape return statements
Building RatOS-configurator app...
Installing dependencies...
Running pnpm install from /home/chief/code/RatOS-dev/configurator-deployment-worktrees/local-deploy-branch-automation-deployment/src
Lockfile is up to date, resolution step is skipped
Packages: +1032
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 1032, reused 1032, downloaded 0, added 1032, done

dependencies:
+ @formkit/auto-animate 0.8.0
+ @headlessui/react 1.7.8
+ @heroicons/react 2.0.14
+ @hookform/resolvers 3.3.4
+ @inkjs/ui 2.0.0
+ @limegrass/eslint-plugin-import-alias 1.3.0
+ @loofkid/wireless-tools 1.5.0
+ @radix-ui/react-alert-dialog 1.0.5
+ @radix-ui/react-checkbox 1.0.4
+ @radix-ui/react-dialog 1.0.5
+ @radix-ui/react-dropdown-menu 2.0.6
+ @radix-ui/react-icons 1.3.0
+ @radix-ui/react-label 2.0.2
+ @radix-ui/react-menubar 1.0.4
+ @radix-ui/react-popover 1.0.7
+ @radix-ui/react-portal 1.0.4
+ @radix-ui/react-progress 1.1.0
+ @radix-ui/react-radio-group 1.1.3
+ @radix-ui/react-select 2.0.0
+ @radix-ui/react-separator 1.0.3
+ @radix-ui/react-slider 1.1.2
+ @radix-ui/react-slot 1.0.2
+ @radix-ui/react-switch 1.0.3
+ @radix-ui/react-tooltip 1.0.7
+ @react-hook/resize-observer 1.2.6
+ @recoiljs/refine 0.1.1
+ @schema-hub/zod-error-formatter 0.0.8
+ @shelf/fast-chunk-string 3.0.0
+ @tailwindcss/container-queries 0.1.1
+ @tailwindcss/forms 0.5.7
+ @tanstack/react-query 4.36.1
+ @tanstack/react-table 8.11.7
+ @tanstack/react-virtual 3.0.2
+ @tensorflow/tfjs-backend-cpu 4.22.0
+ @tensorflow/tfjs-backend-wasm 4.22.0
+ @tensorflow/tfjs-backend-webgl 4.22.0
+ @tensorflow/tfjs-backend-webgpu 4.22.0
+ @tensorflow/tfjs-core 4.22.0
+ @tensorflow/tfjs-data 4.22.0
+ @trpc/client 10.45.1
+ @trpc/next 10.45.1
+ @trpc/react-query 10.45.1
+ @trpc/server 10.45.1
+ @types/chai-string 1.4.5
+ @types/color-convert 2.0.3
+ @types/deep-equal 1.0.4
+ @types/ndjson 2.0.4
+ @types/progress-stream 2.0.5
+ @types/refractor 3.4.1
+ @types/semver 7.5.8
+ @typescript-eslint/eslint-plugin 7.0.2
+ @use-gesture/react 10.3.0
+ axios 0.26.1
+ bignumber.js 9.1.2
+ chai-string 1.5.0
+ class-variance-authority 0.7.0
+ clsx 1.2.1
+ cmdk 1.0.0
+ color-convert 2.0.1
+ commander 11.1.0
+ copy-files-from-to 3.9.1
+ date-and-time 3.5.0
+ deep-equal 2.2.3
+ esbuild 0.20.0
+ esbuild-plugin-pino 2.2.0
+ eslint-plugin-prettier 5.1.3
+ file-type 17.1.6
+ framer-motion 11.2.6
+ glob 10.3.10
+ ink 5.0.0
+ ink-progress-bar 3.0.0
+ ink-spinner 5.0.0
+ ink-table 3.1.0
+ install 0.13.0
+ jszip 3.10.1
+ lucide-react 0.363.0
+ luxon 3.4.4
+ mini-svg-data-uri 1.4.4
+ next 13.5.6
+ next-superjson-plugin 0.6.2
+ next-themes 0.3.0
+ node-cache 5.1.2
+ npm 10.5.0
+ object-hash 3.0.0
+ observable-webworker 6.0.1
+ pino 8.17.2
+ pino-pretty 10.3.1
+ pino-pretty-browser 9.1.2
+ progress-stream 2.0.0
+ react 18.2.0
+ react-countup 6.5.0
+ react-devtools-core 4.19.1
+ react-diff-view 3.2.0
+ react-dom 18.2.0
+ react-error-boundary 6.0.0
+ react-hook-form 7.51.2
+ react-hotkeys-hook 4.5.0
+ react-resizable-panels 2.0.16
+ react-use-localstorage 3.5.3
+ react-use-websocket 4.5.0
+ read-package-up 11.0.0
+ recoil 0.7.7
+ recoil-sync 0.2.0
+ refractor 3.6.0
+ ring-buffer-ts 1.2.0
+ rxjs 7.8.1
+ scichart 3.5.782
+ scichart-react 0.1.13
+ screenfull 6.0.2
+ semver 7.6.3
+ server-only 0.0.1
+ sonner 1.4.41
+ split2 4.2.0
+ superjson 2.2.1
+ tailwind-merge 2.3.0
+ tailwindcss-animate 1.0.7
+ ts-deepmerge 7.0.0
+ tsx 4.7.0
+ typescript 5.5.2
+ use-callback-ref 1.3.1
+ uuid 9.0.1
+ vaul 0.9.0
+ vite-tsconfig-paths 4.3.2
+ zod 3.22.4
+ zod-refine 1.1.1
+ zx 8.1.4

devDependencies:
+ @jest/globals 29.5.0
+ @testing-library/jest-dom 5.16.5
+ @testing-library/react 14.0.0
+ @total-typescript/ts-reset 0.5.1
+ @types/luxon 3.4.2
+ @types/node 18.19.4
+ @types/object-hash 3.0.6
+ @types/react 18.2.21
+ @types/split2 4.2.3
+ @types/uuid 9.0.8
+ @typescript-eslint/parser 6.19.0
+ @typescript-eslint/typescript-estree 6.19.0
+ @vitest/coverage-v8 1.1.1
+ @vitest/ui 1.6.0
+ autoprefixer 10.4.13
+ dotenv 16.3.1
+ encoding 0.1.13
+ eslint 8.56.0
+ eslint-config-next 13.5.6
+ eslint-plugin-react-hooks 4.6.0
+ eslint-plugin-unused-imports 3.0.0
+ ink-testing-library 4.0.0
+ jest-environment-jsdom 29.5.0
+ postcss 8.4.33
+ prettier 3.2.4
+ prettier-eslint 16.3.0
+ prettier-plugin-tailwindcss 0.5.14
+ tailwind-scrollbar 3.1.0
+ tailwindcss 3.4.3
+ tinybench 2.8.0
+ vitest 1.6.0

╭ Warning ───────────────────────────────────────────────────────────────────────────────────╮
│                                                                                            │
│   Ignored build scripts: esbuild.                                                          │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.   │
│                                                                                            │
╰────────────────────────────────────────────────────────────────────────────────────────────╯

Done in 3.2s using pnpm v10.24.0
Building application...

> ratos-configurator@2.1.0 build /home/chief/code/RatOS-dev/configurator-deployment-worktrees/local-deploy-branch-automation-deployment/src
> pnpm run copyScichartData && next build


> ratos-configurator@2.1.0 copyScichartData /home/chief/code/RatOS-dev/configurator-deployment-worktrees/local-deploy-branch-automation-deployment/src
> copy-files-from-to --config copy-files-from-to.json

Reading copy instructions from file copy-files-from-to.json

Starting copy operation in "default" mode: (overwrite option is on)
 ✓ Copied [binary] node_modules/scichart/_wasm/scichart2d.data to public/scichart2d.data
 ✓ Copied [binary] node_modules/scichart/_wasm/scichart2d.wasm to public/scichart2d.wasm
 ✓ Copied [binary] node_modules/scichart/_wasm/scichart3d.data to public/scichart3d.data
 ✓ Copied [binary] node_modules/scichart/_wasm/scichart3d.wasm to public/scichart3d.wasm
 ✓ Copied [binary] node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm to public/tfjs-backend-wasm.wasm
 ✓ Copied [binary] node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-simd.wasm to public/tfjs-backend-wasm-simd.wasm
 ✓ Copied [binary] node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-threaded-simd.wasm to public/tfjs-backend-wasm-threaded-simd.wasm
Browserslist: caniuse-lite is outdated. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
Browserslist: caniuse-lite is outdated. Please run:
  npx browserslist@latest --update-db
  Why you should do it regularly: https://github.com/browserslist/browserslist#browsers-data-updating
 ✓ Creating an optimized production build    
 ✓ Compiled successfully
 ✓ Linting and checking validity of types    
 ✓ Collecting page data    
 ✓ Generating static pages (13/13) 
 ✓ Collecting build traces    
 ✓ Finalizing page optimization    

Route (app)                                   Size     First Load JS
┌ λ /                                         11.3 kB         202 kB
├ λ /_not-found                               927 B          82.1 kB
├ λ /analysis                                 13.3 kB         858 kB
├ λ /analysis/macros                          3.66 kB         416 kB
├ λ /analysis/macros/[id]                     388 B          81.6 kB
├ λ /analysis/macros/[id]/edit                2.51 kB         884 kB
├ λ /analysis/macros/[id]/recordings          3.48 kB         435 kB
├ λ /analysis/macros/[id]/recordings/[runId]  121 kB          988 kB
├ λ /analysis/macros/new                      1.06 kB         883 kB
├ λ /calibration                              32 kB           301 kB
├ ○ /icon.svg                                 0 B                0 B
├ λ /motion                                   1.78 kB         424 kB
├ λ /toolhead                                 8.02 kB         357 kB
├ λ /update-logs                              9.41 kB         262 kB
└ λ /wizard                                   31.5 kB         459 kB
+ First Load JS shared by all                 81.2 kB
  ├ chunks/8458-94fd4fc7ee07d7b5.js           27.7 kB
  ├ chunks/fa86fe2e-e962572a02b89204.js       51.1 kB
  ├ chunks/main-app-f6f529e5ba0d9511.js       286 B
  └ chunks/webpack-f48214e0e37d707c.js        2.1 kB

Route (pages)                                 Size     First Load JS
┌ λ /api/debug-zip                            0 B            80.8 kB
├ λ /api/dfu-image                            0 B            80.8 kB
├ λ /api/download-firmware                    0 B            80.8 kB
├ λ /api/mcu-image                            0 B            80.8 kB
├ λ /api/printer-image                        0 B            80.8 kB
├ λ /api/trpc/[trpc]                          0 B            80.8 kB
├ λ /api/update-logs/download                 0 B            80.8 kB
└ λ /api/update-logs/generate-test-data       0 B            80.8 kB
+ First Load JS shared by all                 80.8 kB
  ├ chunks/framework-7ef06f7468ce0826.js      45.3 kB
  ├ chunks/main-306731d75a7e33f7.js           33.2 kB
  ├ chunks/pages/_app-4b835bcef9b7da71.js     254 B
  └ chunks/webpack-f48214e0e37d707c.js        2.1 kB

λ  (Server)  server-side renders at runtime (uses getInitialProps or getServerSideProps)
○  (Static)  automatically rendered as static HTML (uses no initial props)

Building CLI...

> ratos-configurator@2.1.0 build:cli /home/chief/code/RatOS-dev/configurator-deployment-worktrees/local-deploy-branch-automation-deployment/src
> cd ./cli && tsx ./build.ts

Build complete.
Cleaning up build worktree at: /home/chief/code/RatOS-dev/configurator-deployment-worktrees/local-deploy-branch-automation-deployment
Cleanup complete.
Deployment branch created!
View your deployment branches using 'git worktree list'
```
#### Publishing the test Deployment branch

The `create-local-deployment` uses [`git worktree`](https://git-scm.com/docs/git-worktree) to create your
deployment branch in a separate working directory. This allows you
to keep both your current branch, and the deployment branch
checked out simultaneously.

To commit, cd into the worktree, and use `git push`.

## Help and support

Please use the unofficial Rat Rig discord for help and support. Only create an issue if you have found a bug and can describe how to reproduce it, feature requests and discussions should happen in the #ratos-development channel on discord.

<a href="http://discord.gg/ratrig" target="_blank" rel="noopener noreferrer" style="margin-left: 5px;"><img src="https://img.shields.io/discord/582187371529764864?color=%235865F2&amp;label=discord&amp;logo=discord&amp;logoColor=white&amp;style=flat" alt="discord"></a>

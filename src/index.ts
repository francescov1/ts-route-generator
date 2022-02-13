import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { generate } from './generator'

async function start() {

  // Note: hideBin is a shorthand for process.argv.slice(2). It has the benefit that it takes into account variations in some environments, e.g., Electron.
  const argv = await yargs(hideBin(process.argv)).options({
    ignorePaths: {
      type: 'array',
      default: [],
      alias: 'ignore'
    },
    outputPath: {
      type: 'string',
      alias: '-o',
      default: './src/routes.ts'
    }
  }).argv 
  
  // Controller blob match
  console.log(argv)
  const controllerPath = argv._[0]?.toString() ?? './**/controllers/**/*.ts'
  const {ignorePaths, outputPath} = argv

  // TODO: Validate that output path points to a file, not folder.
  await generate({
    controllerPath, 
    ignorePaths,
    outputPath
  })

  process.exit();
}

start()


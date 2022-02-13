import { Project, InterfaceDeclaration } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import glob from 'glob';

// TODO: Use writer to generate file: https://ts-morph.com/setup/adding-source-files#by-writer-function

function parseRouteInterface(interfaceDec: InterfaceDeclaration) {
  const structure = interfaceDec.getStructure();
  // console.log(structure)

  const { name } = structure;

  const mainDocTags = (structure.docs[0] as any).tags;
  const routeTag = mainDocTags.find((tag: any) => tag.tagName === 'route');

  const [, method, fullRoutePath] =
    routeTag.text.match(/(GET|POST|PUT|DELETE) (\/.*)/) ?? [];

  if (!method)
    throw new Error(`No method found in @route tag: ${routeTag.text}`);
  if (!fullRoutePath)
    throw new Error(
      `No path found in @route tag: ${routeTag.text}.\nEnsure @route tags take the following format: [METHOD] /[PATH]\nExample: GET /api/users/me`
    );

  const responseProperty = structure.properties.find(
    (prop) => prop.name === 'response'
  );
  const responseDocTags = (responseProperty.docs?.[0] as any)?.tags;

  let status: string = responseDocTags?.find(
    (tag: any) => tag.tagName === 'status'
  )?.text;

  // If no status tag, default to 201 for POST/PUT/DELETE, 200 for GET
  if (!status) status = method === 'GET' ? '200' : '201';

  const hasBody = structure.properties.some((prop) => prop.name === 'body');
  const hasParams = structure.properties.some((prop) => prop.name === 'params');
  const hasQuery = structure.properties.some((prop) => prop.name === 'query');
  return {
    name,
    method,
    fullRoutePath,
    status: Number(status),
    hasBody,
    hasParams,
    hasQuery
  };
}

function generateTsValidator(
  controllerName: string,
  {
    hasBody,
    hasParams,
    hasQuery
  }: { hasBody: boolean; hasParams: boolean; hasQuery: boolean }
): string {
  if (!hasBody && !hasParams && !hasQuery) return '';

  let tsValidator = `(req, _res, next) => { try {`;
  if (hasBody)
    tsValidator += `assertType<controller.${controllerName}["body"]>(req.body);`;
  if (hasParams)
    tsValidator += `assertType<controller.${controllerName}["params"]>(req.params);`;
  if (hasQuery)
    tsValidator += `assertType<controller.${controllerName}["query"]>(req.query);`;

  tsValidator += 'return next();';
  tsValidator += `} catch(err) { return next(err); } }`;
  tsValidator += ',';
  return tsValidator;
}

function generateMiddleware(controllerName: string, controller: any): string[] {
  // If controller is not an array, we dont have any middleware to add
  if (!Array.isArray(controller)) return [];

  const middlewareFuncs = [...controller];
  middlewareFuncs.pop();

  return middlewareFuncs.map((_controllerFunc, idx) => {
    return `controller.${controllerName}[${idx}]`;
    // This is more ideal, since it removes the need for a try catch block, but its timing out tests
    // return `(req: any, res: Response, next: NextFunction) => controller.${controllerName}[${idx}](req, res, next)?.then(() => next())?.catch(next)`;
  });
}

function generateMainHandler(
  controllerName: string,
  controller: any,
  status: number
) {
  // If controller is array, means the last item is the main controller handler and all previous items are middleware funcs
  const name = Array.isArray(controller)
    ? `${controllerName}[${controller.length - 1}]`
    : controllerName;
  const mainHandler = `(req: any, res: Response, next: NextFunction) => controller.${name}(req, res, next).then(resBody => res.status(${status}).send(resBody)).catch(next)`;
  return mainHandler;
}

const HEADER = `/* tslint:disable */\n/* eslint-disable */\n\n// ######################################## THIS FILE WAS GENERATED, DO NOT EDIT DIRECTLY ######################################## //\n\n`;
function generateRouter(controllerPath: string, project: Project) {
  const filename = path.basename(controllerPath, '.ts');
  const routePath = controllerPath.replace('controllers', 'routes');

  // validate controller import exists
  const localImportPath = path.join(
    path.relative(__dirname, path.dirname(controllerPath)),
    filename
  );

  const controllers = require(localImportPath);

  // This array is used to ensure we dont have any unused controller functions (ie controller functions without associated interfaces)
  let unusedControllerFuncs = Object.keys(controllers);

  // Get relative path for import between gened routes folder and controller folder, add filename at end
  const genImportPath = path.join(
    path.relative(path.dirname(routePath), path.dirname(controllerPath)),
    filename
  );


  // TODO: generate all in one file
  
  const importsAndInits = `import express, { Response, NextFunction } from "express";import {assertType} from "typescript-is";import * as controller from "${genImportPath}";const router = express.Router();`;

  const sourceFile = project.getSourceFileOrThrow(controllerPath);
  const interfaces = sourceFile.getInterfaces();

  let routerStr = HEADER;
  routerStr += importsAndInits;
  interfaces.forEach((interfaceDec) => {
    const routeSpec = parseRouteInterface(interfaceDec);
    const {
      name,
      method,
      fullRoutePath,
      status,
      hasBody,
      hasParams,
      hasQuery
    } = routeSpec;

    const controller = controllers[name];
    if (!controller)
      throw new Error(
        `Route handler interface ${name} did not have an associated controller. Ensure all route handler interfaces have associated controller functions with the same name.`
      );

    unusedControllerFuncs = unusedControllerFuncs.filter(
      (funcName) => funcName !== name
    );

    const baseRoutePath = controllerPath
    .split('controllers')[1] // TODO: Might need to review this, use cli args instead
      .replace('.ts', '');
    const routePath = fullRoutePath.replace(baseRoutePath, '');

    routerStr += `router.${method.toLowerCase()}("${
      routePath === '' ? '/' : routePath
    }", `;
    routerStr += generateTsValidator(name, { hasBody, hasParams, hasQuery });
    const middlewareArray = generateMiddleware(name, controller);
    if (middlewareArray.length > 0) {
      routerStr += middlewareArray.join(',');
      routerStr += ',';
    }
    routerStr += generateMainHandler(name, controller, status);
    routerStr += `);\n`;

    return routeSpec;
  });

  if (unusedControllerFuncs.length > 0) {
    throw new Error(
      `Controller function(s) found without associated interfaces: ${unusedControllerFuncs}. Ensure all controller functions have associated route handler interfaces with the same name.`
    );
  }

  routerStr += `export = router;`;

  // Router gets written to equivalent path in `routes`
  fs.writeFileSync(routePath, routerStr);
}

export function generate({controllerPath, ignorePaths, outputPath} :{controllerPath: string, ignorePaths: string[]; outputPath: string}) {
  const filePaths = glob.sync(controllerPath, {
    ignore: ignorePaths
  });
  console.log(`Generating ${outputPath} using controllers from ${controllerPath}`);
  
  const project = new Project({});
  project.addSourceFilesAtPaths([controllerPath]);
  
  try {
    filePaths.forEach((filePath) => generateRouter(filePath, project));
  } catch (err) {
    console.error(err);
  }
}

// const userInterface = sourceFile.getInterface("getUser");
// await sourceFile.save();

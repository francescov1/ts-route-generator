import { Request, Response, NextFunction } from 'express';
import {
  ParamsDictionary,
  Query,
  RequestHandler
  // eslint-disable-next-line import/no-unresolved
} from 'express-serve-static-core';


// TODO: make these types accessible - export from this package when it gets imported - will need to ensure we handle the cli separately

export interface RouteDefinition {
  body?: {
    [key: string]: any;
  };
  params?: ParamsDictionary;
  query?: Query;
  response: {
    [key: string]: any;
  };
}
export type RouteHandler<T extends RouteDefinition> = (
  req: Request<T['params'], T['response'], T['body'], T['query']>,
  res: Response,
  next: NextFunction
) => Promise<T['response']>;

// Alias
export type RH<T extends RouteDefinition> = RouteHandler<T>

type TypedMiddlewareHandler<T extends RouteDefinition> = (
  req: Request<T['params'], T['response'], T['body'], T['query']>,
  res: Response,
  next: NextFunction
) => Promise<void>;

// NOTE: ideally we dont need RequestHandler as an option for this type, but
// certain middleware like multer make it tough to get a custom typed express middleware function
export type MiddlewareHandler<T extends RouteDefinition> =
  | RequestHandler
  | TypedMiddlewareHandler<T>;

  // Alias
export type MH<T extends RouteDefinition> = MiddlewareHandler<T>

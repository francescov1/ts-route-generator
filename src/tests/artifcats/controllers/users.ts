
import { RH } from '../../../utils';

//  /**
//  * Get a user
//  * @route GET /api/users/:userId
//  */
export interface getUser {
  query: {
    isDeleted?: '0' | '1';
  };
  params: {
    /** User to fetch */
    userId: string;
  };
  /**
   * @status 200
   */
  response: {
    id: string;
    name: string;
    email: string;
  };
}
export const getUser: RH<getUser> = async (req) => {
  // Type safe
  console.log(req.params.userId) // string
  console.log(req.query.isDeleted) // "0" | "1"

  // Throws an error
  // console.log(req.body.missingProperty) 

  return {
    id: '5deeb1e2593cc96e40a79086',
    name: 'John Doe',
    email: 'johndoe@example.com'
  };
}

// TODO: Middleware for getUser

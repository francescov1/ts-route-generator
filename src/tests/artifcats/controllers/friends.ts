import { RH } from '../../../utils';
//  /**
//  * Add a friend
//  * @route POST /api/friends
//  */
export interface addFriend {
  /**
   * ```json
   * { userId: '5deeb1e2593cc96e40a79086' }
   * ```
   */
  body: {
    /** User to add as a friend */
    userId: string;
  };
  /**
   * @status 201
   */
  response: {};
}
export const addFriend: RH<addFriend> = async (req) => {

  // Type safe
  console.log(req.body.userId)

  // Throws an error
  // console.log(req.body.missingProperty) 

  return {};
}
export { createDb, createDbClient, type Db, type DbClient } from './client.js';
export { getDbHealth, pingDb, type DbHealth } from './health.js';
export * from './schema/index.js';
export { mapApiKey, mapMembership, mapOrganization, mapRefreshToken, mapUser } from './mappers.js';
export { mapBranch, mapCommit, mapCourse, mapSnapshot, mapWorkingTree } from './mappers/courses.js';

export { findUserByEmail, findUserById, insertUser } from './repos/users.js';

export {
  addMembership,
  countOwners,
  findOrganizationById,
  findOrganizationBySlug,
  getMembership,
  insertOrganization,
  listMembers,
  listMembershipsForUser,
  removeMembership,
  updateMembershipRole,
} from './repos/organizations.js';

export {
  findApiKeyByHash,
  findApiKeyById,
  insertApiKey,
  listApiKeysForOrg,
  revokeApiKey,
  touchApiKeyLastUsed,
} from './repos/api-keys.js';

export {
  findValidRefreshToken,
  insertRefreshToken,
  revokeRefreshToken,
} from './repos/refresh-tokens.js';

export {
  CourseRepository,
  ensurePostgresExtensions,
  type CreateCourseInput,
} from './repositories/courses.js';

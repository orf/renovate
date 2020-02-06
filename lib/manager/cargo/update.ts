import { isEqual } from 'lodash';
import { parse } from 'toml';
import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';
import { CargoConfig, CargoSection } from './types';

// Return true if the match string is found at index in content
function matchAt(content: string, index: number, match: string): boolean {
  return content.substring(index, index + match.length) === match;
}

// Replace oldString with newString at location index of content
function replaceAt(
  content: string,
  index: number,
  oldString: string,
  newString: string
): string {
  logger.debug(`Replacing ${oldString} with ${newString} at index ${index}`);
  return (
    content.substr(0, index) +
    newString +
    content.substr(index + oldString.length)
  );
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string {
  logger.trace({ config: upgrade }, 'poetry.updateDependency()');
  if (!upgrade) {
    return fileContent;
  }
  const { target, depType, depName, newValue, managerData } = upgrade;
  const { nestedVersion } = managerData;
  let parsedContent: CargoConfig;
  try {
    parsedContent = parse(fileContent);
  } catch (err) {
    logger.debug({ err }, 'Error parsing Cargo.toml file');
    return fileContent;
  }
  let section: CargoSection;
  if (target) {
    section = parsedContent.target[target];
    if (section) {
      section = section[depType];
    }
  } else {
    section = parsedContent[depType];
  }
  if (!section) {
    if (target) {
      logger.info(
        { config: upgrade },
        `Error: Section [target.${target}.${depType}] doesn't exist in Cargo.toml file, update failed`
      );
    } else {
      logger.info(
        { config: upgrade },
        `Error: Section [${depType}] doesn't exist in Cargo.toml file, update failed`
      );
    }
    return fileContent;
  }
  let oldVersion: any;
  const oldDep = section[depName];
  if (!oldDep) {
    logger.info(
      { config: upgrade },
      `Could not get version of dependency ${depName}, update failed (most likely name is invalid)`
    );
    return fileContent;
  }
  oldVersion = section[depName];
  // if (typeof oldVersion !== 'string') {
  //   if (oldVersion.version) {
  //     oldVersion = oldVersion.version;
  //   } else {
  //     oldVersion = null;
  //   }
  // }
  if (nestedVersion) {
    oldVersion = oldVersion.version;
  }
  if (!oldVersion) {
    logger.info(
      { config: upgrade },
      `Could not get version of dependency ${depName}, update failed (most likely name is invalid)`
    );
    return fileContent;
  }
  if (oldVersion === newValue) {
    logger.info('Version is already updated');
    return fileContent;
  }
  if (nestedVersion) {
    section[depName].version = newValue;
  } else {
    section[depName] = newValue;
  }
  if (target) {
    parsedContent.target[target][depType] = section;
  } else {
    parsedContent[depType] = section;
  }
  const searchString = `"${oldVersion}"`;
  const newString = `"${newValue}"`;
  let newFileContent = fileContent;
  let searchIndex = fileContent.indexOf(`${depName}`) + depName.length;
  for (; searchIndex < fileContent.length; searchIndex += 1) {
    // First check if we have a hit for the old version
    if (matchAt(fileContent, searchIndex, searchString)) {
      logger.trace(`Found match at index ${searchIndex}`);
      // Now test if the result matches
      const testContent = replaceAt(
        fileContent,
        searchIndex,
        searchString,
        newString
      );
      // Compare the parsed toml structure of old and new
      if (isEqual(parsedContent, parse(testContent))) {
        newFileContent = testContent;
        break;
      } else {
        logger.debug('Mismatched replace at searchIndex ' + searchIndex);
      }
    }
  }
  return newFileContent;
}

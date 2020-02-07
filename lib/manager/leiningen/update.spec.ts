/* eslint-disable no-template-curly-in-string */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

const leinProjectClj = readFileSync(
  resolve(__dirname, `./__fixtures__/project.clj`),
  'utf8'
);

describe('manager/leiningen/update', () => {
  it('updatePackageFile', () => {
    const { deps } = extractPackageFile(leinProjectClj);
    const dep = deps.pop();
    const upgrade = {
      ...dep,
      newValue: `${dep.currentValue}-9999`,
    };
    const { currentValue, newValue } = upgrade;
    const newFileContent = updateDependency({
      fileContent: leinProjectClj,
      upgrade,
    });
    const cmpContent = leinProjectClj.replace(currentValue, newValue);
    expect(newFileContent).toEqual(cmpContent);
  });
});

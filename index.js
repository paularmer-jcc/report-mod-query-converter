import { readFileSync } from 'node:fs';
import readline from 'node:readline';
import { format as sqlFormat } from 'sql-formatter';
import { copy } from 'copy-paste/promises.js';

const SOURCE_FILE = './source.sql';
console.log(`reading sql from '${SOURCE_FILE}'`);
let sql = readFileSync(SOURCE_FILE, 'utf8').replace(/;/g, '');

// REPLACE THE BI QUERY VARIABLES
const BI_QUERY_VAR_REGEX = /«([^»]+)»/g;
const variableMatches = sql.match(BI_QUERY_VAR_REGEX);
const variables = variableMatches
    ? Object.keys(
          variableMatches.reduce((matchMap, match) => ({ ...matchMap, [match]: true }), {})
      ).map(match => ({ match, name: match.slice(1, -1) }))
    : [];
const VAR_NAME_SUGGESTIONS = {
    start_date: /^(date1?|begdate|month)/gi,
    end_date: /(enddate|edate|date2)/gi,
    justice: /(justice|judge)/gi,
};

if (variables.length) {
    console.log(
        variables.length === 1 ? `found 1 variable` : `found ${variables.length} variables`
    );

    const consoleInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const prompt = query => new Promise(resolve => consoleInterface.question(query, resolve));

    for (const { match, name } of variables) {
        // suggest a new variable name
        const suggestedName = Object.entries(VAR_NAME_SUGGESTIONS).reduce(
            (varName, [suggestion, regExp]) => (regExp.test(varName) ? suggestion : varName),
            name.toLowerCase().replace(/ /g, '_')
        );

        // ask for new var name (or accept suggestion)
        const newVarName =
            (await prompt(`${match} variable name (${suggestedName}): `)) || suggestedName;
        const isDate = newVarName.includes('date'); // maybe prompt user for var type?
        sql = sql.replaceAll(
            match,
            isDate ? `to_date(:${newVarName}, 'mm/dd/yyyy')` : `:${newVarName}`
        );
    }

    consoleInterface.close();
}

// ALIAS DESCRIPTION COLUMNS
const DESCRIPTION_CODE_REGEX = /([A-Za-z_]+)\.(DESCRIPTION|CODE|CODE_NAME|VOID)(\,?) /gi;
let [selectStatement, restOfSql] = sql.split('from'); // only alias the select statement
for (const [fullMatch, tableName, columnName, maybeComma] of selectStatement.matchAll(
    DESCRIPTION_CODE_REGEX
)) {
    const aliasName = fullMatch.includes('VOID') ? `${tableName}_VOID` : tableName;
    selectStatement = selectStatement.replace(
        fullMatch,
        `${tableName}.${columnName} ${aliasName}${maybeComma} `
    );
}

await copy(sqlFormat(`${selectStatement} from ${restOfSql}`, { language: 'plsql' }));
console.log('formatted sql copied to clipboard');

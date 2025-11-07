import { readFileSync } from 'node:fs';
import readline from 'node:readline';
import { format as sqlFormat } from 'sql-formatter';
import { copy } from 'copy-paste/promises.js';

try {
    let sql = readSource();
    sql = await replaceVariables(sql);
    sql = aliasColumns(sql);
    copyToClipboard(sql);
} catch (e) {
    console.error(e);
}

function readSource() {
    const SOURCE_FILE = './source.sql';
    console.log(`reading sql from '${SOURCE_FILE}'`);
    return readFileSync(SOURCE_FILE, 'utf8').replace(/;/g, '');
}

async function replaceVariables(sourceSql) {
    const BI_QUERY_VAR_REGEX = /«([^»]+)»/g;
    const variableMatches = sourceSql.match(BI_QUERY_VAR_REGEX);
    const variables = variableMatches
        ? Object.keys(
              variableMatches.reduce((matchMap, match) => ({ ...matchMap, [match]: true }), {})
          ).map(match => ({ match, name: match.slice(1, -1) }))
        : [];
    const VAR_NAME_SUGGESTIONS = {
        start_date: /^(date1?|begdate|beginningdate|month)/gi,
        end_date: /(enddate|edate|date2)/gi,
        justice: /(justice|judge)/gi,
    };

    switch (variables.length) {
        case 0:
            console.log('no variables found');
            break;
        case 1:
            console.log('found 1 variable');
            break;
        default:
            console.log(`found ${variables.length} found`);
    }

    let modifiedSql = sourceSql;
    if (variables.length) {
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
            modifiedSql = modifiedSql.replaceAll(
                match,
                isDate ? `to_date(:${newVarName}, 'mm/dd/yyyy')` : `:${newVarName}`
            );
        }

        consoleInterface.close();
    }
    return modifiedSql;
}

function aliasColumns(sourceSql) {
    const DESCRIPTION_CODE_REGEX = /([A-Za-z_]+)\.(DESCRIPTION|CODE|CODE_NAME|VOID)(\,?) /gi;
    const fromIndex = sourceSql.indexOf('from');
    let selectStatement = sourceSql.slice(0, fromIndex); // only alias the first select statement
    const restOfSql = sourceSql.slice(fromIndex);

    for (const [fullMatch, tableName, columnName, maybeComma] of selectStatement.matchAll(
        DESCRIPTION_CODE_REGEX
    )) {
        const aliasName = fullMatch.includes('VOID') ? `${tableName}_VOID` : tableName;
        selectStatement = selectStatement.replace(
            fullMatch,
            `${tableName}.${columnName} ${aliasName}${maybeComma} `
        );
    }

    return `${selectStatement} from ${restOfSql}`;
}

async function copyToClipboard(sourceSql) {
    await copy(sqlFormat(sourceSql, { language: 'plsql' }));
    console.log('formatted sql copied to clipboard');
}

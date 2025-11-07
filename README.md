# Requirements & Installation

-   Requires node.js and npm: [https://nodejs.org/en](https://nodejs.org/en)
-   Download this repo locally:
    -   `git clone https://github.com/paularmer-jcc/report-mod-query-converter.git`.
    -   or use the green `<> Code` button on the [repo page](https://github.com/paularmer-jcc/report-mod-query-converter).
-   To install, run `npm install` in the root of the project.

# Usage

1. Copy your BI Query into `source.sql`
1. Run the script: `npm run start`
    - If the query has variables in it, you will be prompted to input a new name for them.
    - Suggested names are provided in `(var_name)`. To accept the suggestion, simply hit enter
    - Variable names that have the word `date` in them will be wrapped in `to_date(:var_name, 'mm/dd/yyyy')`.
1. The formatted sql will be inserted into your clipboard for you to paste into Power BI.

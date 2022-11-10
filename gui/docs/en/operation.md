# Operation

> To report feature requests or problem, please contact us at [feedback@open-diffix.org](mailto:feedback@open-diffix.org).

**Diffix Dashboards'** purpose is to allow anonymized analysis of data using Metabase, an easy to use Business Intelligence (BI) tool.

With **Diffix Dashboards** you will be able to pick one or more CSV files containing personal data, and transform them into Metabase-driven
summaries and charts in a way which ensures GDPR-compliant anonymity. For details on the anonymization procedure itself see [Anonymization](anonymization.md).

## Running **Diffix Dashboards**

When you start **Diffix Dashboards**, it will start an internal local database (powered by [PostgreSQL](https://www.postgresql.org/)) and
a local [Metabase](https://www.metabase.com/) engine. Both services are required for **Diffix Dashboards** to function correctly.

Initial startup of PostgreSQL and Metabase might take a while, but is faster on subsequent starts of **Diffix Dashboards**.
Please ensure that **Diffix Dashboards** displays two green checkmarks on its main `Admin Panel` tab:

![](images/services.png#480)

If you experience something different, please refer to the section [Troubleshooting](#troubleshooting) below for guidance.

## Data Import

If you do not want to import your data and prefer to experiment with the sample data provided, skip to the section [Using Metabase](#using-metabase).

In order to anonymize and explore your data in **Diffix Dashboards** you need to import it first. The process to import a CSV file into
**Diffix Dashboards** is straightforward. Request a new import on the `Admin Panel` tab and follow instructions in the left-hand side bar.

![](images/import.png#480)

If you have several files to import, you can work on them in parallel by opening multiple import tabs.

Whenever you import a table having a Metabase tab open, you will notice `Refresh` icons appear at the tab headers.
When you click on the icon, it will cause the respective Metabase tab to reload to acknowledge the new tables.
**NOTICE**: if you have any ongoing work in the tab it might be lost on refresh. In this case open a new Metabase tab to work with the new tables.

## Using Metabase

When you click the `+ New Metabase Tab` button in the top portion of **Diffix Dashboards**, you'll be taken to a Metabase instance.

This section gives a brief overview of how to navigate Metabase. If you're already familiar with it, you will find it works
just like regular Metabase you would open in a web browser tab, except for a few notable differences.

Start by clicking `Browse data` in the left-hand sidebar and then choose how do you want to explore your data:

### Anonymized access

The `Anonymized access` data source accesses your data with **Diffix Fir** anonymization enabled for all tables (except ones you
explicitly marked to not contain personal data during import).

When you choose a table with personal data, you will see a notification `There was a problem with your question`. This means **Diffix Fir** blocked access to
the direct preview of the table which Metabase offers by default. Navigate to `Summarize` and choose `Group by` columns (make sure to not pick
the column which identifies the protected entity). Click `Done` to view an anonymized summary of the data.

![](images/summarize.png#480)

Next, you can click `Visualization` in the lower left portion of the screen to present your Metabase question in a chart.

Finally, you can click `Save` and add your newly created chart to a dashboard, which will be accessible after you exit and start **Diffix Dashboards** again.

In order to compose an anonymized SQL query directly, use the `+ New` button, select `SQL query`, `Anonymized access` and type SQL as you normally would.

![](images/sql_query.png#480)

In case you stumble upon a SQL feature blocked by **Diffix Fir** you should see an error message providing a hint as to what is wrong.
In the example below we have tried to `SELECT` the protected entity ID directly.

![](images/protected_entity_error.png#480)

### Direct access

The `Direct access` data source contains the same data tables as `Anonymized access`, but access to the data bypasses **Diffix Fir** completely.

You can use all the features of Metabase without restrictions or use it to compare anonymized results versus non-anonymized ones.

**CAUTION**: All the questions, SQL queries and dashboards using `Direct access` as data source will **not be anonymous**.

### Metabase and Diffix

This section lists a few notable differences between the regular Metabase experience and the one you will have with **Diffix Dashboards**.

**No login** - **Diffix Dashboards** arranges a Metabase session for you, so you don't have to register or login.

**Local data** - all the data and dashboards are local and cannot be collaborated on remotely.

**Limitations of automatic data exploration tools** - **Diffix Dashboards** operates using **Diffix Fir** anonymization software
(see [Anonymization](anonymization.md) for more details) and because of that it limits the SQL features available to the user. When
exploring data via the `Anonymized access` data source you might stumble upon functions returning errors, because **Diffix Fir** treats them as non-privacy
preserving and blocks them. If you find anything blocking you, please contact us at [feedback@open-diffix.org](mailto:feedback@open-diffix.org),
we will be happy to discuss your use case and help. Use `Direct access` instead of `Anonymized access` data source to bypass anonymization.

## Troubleshooting

If you find **Diffix Dashboards** doing something unexpected, you can export the logs collected by using the menu function `Actions -> Export Logs`.
Review them to ensure they do not contain any personal data and send them to [feedback@open-diffix.org](mailto:feedback@open-diffix.org).

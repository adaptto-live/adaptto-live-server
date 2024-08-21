# adaptTo() Live Server - Schema Creation for Cosmos DB (MS Azure)

As stated in the [CosmosDB documentation][cosmosdb-limitations], it's not possible to create a unique index after a collection was created:

> Azure Cosmos DB API for SQL or MongoDB accounts that create unique index after the container is created aren't supported for continuous backup. Only containers that create unique index as a part of the initial container creation are supported. For MongoDB accounts, you create unique index using extension commands.

The collection `qa-entries` requires a compound unique partial index to ensure the `entryIndex` numbers are numbered continuously for each talk, generating a number of QA entry numbers for each talk. This works via Mongoose schema definition of a native MongoDB instance, but not for CosmosDB with continuous backup.

The solution is to drop the collection `qa-entries` after creating the collections via Mongoose on server setup, and then recreate it via MongoDB shell using this script:

[qa-entries.txt](qa-entries.txt)


[cosmosdb-limitations]: https://learn.microsoft.com/en-us/azure/cosmos-db/continuous-backup-restore-introduction#current-limitations

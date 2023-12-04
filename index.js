const kDebug = false;
const path = require('path');
const http = require('http');
const https = require('https');
const {MongoClient} = require('mongodb');
const moment = require('moment-timezone');
const express = require('express'); 
const client = new MongoClient(`mongodb://localhost:27017`);
const dbName = `Apollonia_Dental_Practice`;
 

async function findDataWithFilterNaN(collectionName, option) {
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        const query = option.filter ? {} : (option.limit || {});
        const cursor = collection.find(query);
        if (kDebug) {
            console.log("query =>", option.filter);
        }

        if (option.filter) {
            const filters = Array.isArray(option.filter) ? option.filter : [option.filter];
            const filterQuery = {
                $and: []
            };
            filters.forEach(filter => {
                const [column, command, value] = filter.split(',');
                switch (command) {
                    case 'cs': filterQuery.$and.push({
                            [column]: {
                                $regex: value,
                                $options: 'i'
                            }
                        });
                        break;
                    case 'sw': filterQuery.$and.push({
                            [column]: {
                                $regex: `^${value}`,
                                $options: 'i'
                            }
                        });
                        break;
                    case 'ew': filterQuery.$and.push({
                            [column]: {
                                $regex: `${value}$`,
                                $options: 'i'
                            }
                        });
                        break;
                    case 'eq':
                        if (column === '_id') {
                            filterQuery.$and.push({[column]: Number(value)});
                        } else {
                            filterQuery.$and.push({[column]: value});
                        }
                        break;
                    case 'ne':
                        if (column === '_id') {
                            filterQuery.$and.push({
                                [column]: {
                                    $ne: Number(value)
                                }
                            });
                        } else {
                            filterQuery.$and.push({
                                [column]: {
                                    $ne: value
                                }
                            });
                        }
                        break;
                    case 'lt': filterQuery.$and.push({
                            [column]: {
                                $lt: value
                            }
                        });
                        break;
                    case 'le': filterQuery.$and.push({
                            [column]: {
                                $lte: value
                            }
                        });
                        break;
                    case 'ge': filterQuery.$and.push({
                            [column]: {
                                $gte: value
                            }
                        });
                        break;
                    case 'gt': filterQuery.$and.push({
                            [column]: {
                                $gt: value
                            }
                        });
                        break;
                    case 'in': filterQuery.$and.push({
                            [column]: {
                                $in: value.split(',')
                            }
                        });
                        break;
                    case 'ni': filterQuery.$and.push({
                            [column]: {
                                $nin: value.split(',')
                            }
                        });
                        break;
                    case 'is': filterQuery.$and.push({[column]: null});
                        break;
                    case 'no': filterQuery.$and.push({
                            [column]: {
                                $ne: null
                            }
                        });
                        break;
                    default:
                        break;
                }
                // filterQuery.$and.push(filterQuery[column]);
                // console.log("filterQuery =>", filterQuery);
            });
            cursor.filter(filterQuery);
        }

        if (option.column) {
            const columns = option.column.split(',');
            const projection = {};
            columns.forEach(col => projection[col] = 1);
            cursor.project(projection);
        }

        if (option.order) {
            const [objKey, order] = option.order.split(',');
            const sortOrder = (order === 'asc') ? 1 : -1;
            cursor.sort({[objKey]: sortOrder});
        }
        if (kDebug) {
            console.log(option);
        }

        let recordsPerPage = option.page ? parseInt(option.page.split(',')[1]) : 100;
        recordsPerPage = recordsPerPage || 1;
        const currentPage = option.page ? parseInt(option.page.split(',')[0]) : 1;
        const skip = currentPage - 1;
        cursor.skip(skip).limit(recordsPerPage);
        // console.log("cursor ", cursor);
        const records = await cursor.toArray();
        let result = {};

        if (option.transform !== '1') {
            result = {
                [collectionName]: {
                    columns: [],
                    records: []
                }
            };

            records.forEach(record => {
                result[collectionName].columns = (Object.keys(record));
                result[collectionName].records.push(Object.values(record));
            });
        } else {
            result = records;
        }

        return {statusCode: 200, body: result};
    } catch (err) {
        return {statusCode: 500, body: result};
    } finally {
        await client.close();
    }
}

async function insertUpdateData(collections, data) {
    const this_kDebug = kDebug;
    if (data.apiKey) {
        delete data.apiKey;
    }

    try {
        let last_id = 0;
        const option = {
            page: "1,1",
            order: "_id,desc",
            transform: "1"
        }

        if (this_kDebug) {
            console.log("\nupdateData to ", collections, data);
        }

        try {
            last_id_obj = await findDataWithFilter(collections, option);
            last_id = last_id_obj.body[0]._id;
            if (isNaN(last_id)) {
                last_id = 0;
            }
        } catch (err) {}
        if (this_kDebug) {
            console.log("\nlast_id obj ", last_id_obj);
            console.log("\nlast_id", last_id);
        }
        data._id = parseInt(last_id) + 1;
        data.datetime = moment().tz('Asia/Bangkok').format('YYYY-MM-DDTHH:mm:ss.SSSZZ');
        data.date = moment().tz('Asia/Bangkok').format('YYYY-MM-DD');
        data.time = moment().tz('Asia/Bangkok').format('HH:mm:ss');

        if (this_kDebug) {
            console.log("{}=>", data);
        }
        // Connect to the MongoDB database
        await client.connect();
        // Get a reference to the device_configuration collection
        const db = client.db(dbName);
        const collection = db.collection(collections);
        const result = await collection.insertOne(data);
        // Return the result of the operation
        const body = {
            httpStatus: 200,
            payload: "Document with _id " + result.insertedId + " in collection was created successfully"
        };
        return {statusCode: 201, body: body};
    } catch (err) {
        return {statusCode: 500, body: err.message};
    } finally { // Close the database connection
        await client.close();
    }
}

const app = express();
 

app.get('/apiman/v1/apollonia/:path',  async (req, res) => {
    if (kDebug) {
        console.log("GET /apiman/v1/apollonia/:path");
    }
    
        const pathParam = req.params.path;
        const query = req.query; 
        findDataWithFilterNaN(pathParam, query).then(result => {
            res.status(result.statusCode);
            res.send(result.body);
        }).catch(error => {
            res.status(500).send(error.message);
            console.log(error);
        });
    
});

app.post('/apiman/v1/apollonia/:path',   async (req, res) => {
    if (kDebug) {
        console.log("POST /apiman/v1/apollonia/:path");
    }

    
	const pathParam = req.params.path;
        const query = req.body;
        insertUpdateData(pathParam, query).then(result => {
            result.body.req = req.body;
            res.status(result.statusCode);
            res.send(result.body);
        }).catch(error => {
            res.status(500).send(error.message);
            console.log(error);
        }) 
});


app.delete('/apiman/v1/apollonia/:path',   async (req, res) => {
    if (kDebug) {
        console.log("DELETE /apiman/v1/apollonia/:path");
    }

    const apiKey = req.apiKey;
    const Oauth = await authTokenCheck(apiKey);
    if (! Oauth.auth_acknowledgement) {
        apiKeyTools.authFailReturn(res, Oauth);
    } else {
	const pathParam = req.params.path;
        const query = req.query._id;
        deleteDocument(pathParam, query).then(result => {
            res.status(result.statusCode);
            res.send(result.body);
        }).catch(error => {
            res.status(500).send(error.message);
            console.log(error);
        })
    }
});

app.put('/apiman/v1/apollonia/:path',  async (req, res) => {
    if (kDebug) {
        console.log("PUT /apiman/v1/apollonia/:path");
    }

     
	const pathParam = req.params.path;
        const _id = Number(req.body._id);
        req.body._id = _id;
        updateDocument(pathParam, _id, req.body).then(result => {
            result.body.req = req.body;
            res.status(result.statusCode);
            res.send(result.body);
        }).catch(error => {
            res.status(500).send(error.message);
            console.log(error);
        }) ;
});




app.use((req, res, next) => {
    res.status(404).send("Not Found");
});



const httpServer = http.createServer(app);
httpServer.listen(3000, () => {
    console.log(`HTTP server listening on port ${
        3000
    }`);
});

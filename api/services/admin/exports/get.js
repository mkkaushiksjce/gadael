'use strict';

const xlsx = require('xlsx-writestream');
const gt = require('./../../../../modules/gettext');
const tmp = require('tmp');
const fs = require('fs');





exports = module.exports = function(services, app) {

    let service = new services.get(app);



    /**
     * Get data for each export type
     */
    let exportTypes = {

        /**
         * Get balance on date in XLSX
         * @param {Object} params
         * @returns {Promise}
         */
        balance: function(params) {

            return new Promise(function(resolve, reject) {
                if (undefined === params.moment) {
                    return reject(gt.gettext('moment is a mandatory parameter'));
                }

                resolve(require('./balance')(service, params.moment));
            });


        },

        /**
         * All requests between two dates in XLSX
         * @param {Object} params
         * @returns {Promise}
         */
        requests: function(params) {

            return new Promise(function(resolve, reject) {

                if (undefined === params.from || undefined === params.to) {
                    return reject(gt.gettext('from and to are mandatory parameters'));
                }

                resolve(require('./requests')(service, params.from, params.to));
            });
        },


        /**
         * Get requests for all users between 2 dates in sage text format
         * one line per user
         *
         * @param {Object} params
         *
         * @returns {Promise}
         */
        sage: function(params) {
            return new Promise(function(resolve, reject) {

                if (undefined === params.from || undefined === params.to) {
                    return reject(gt.gettext('from and to are mandatory parameters'));
                }

                resolve(require('./sage')(service, params.from, params.to));
            });
        }
    };






    /**
     * Call the export get service
     *
     * @param {Object} params
     * @return {Promise}    Resolve to a temporary file
     */
    service.getResultPromise = function(params) {

        let type = 'balance';
        if (undefined !== params.type && -1 !== ['balance', 'requests', 'sage'].indexOf(params.type)) {
            type = params.type;
        }

        exportTypes[type](params)
        .then(data => {

            let tmpname = tmp.tmpNameSync();

            function callback(err) {
                if (err) {
                    return service.deferred.reject(err);
                }

                service.deferred.resolve(tmpname);
            }

            if ('sage' === type) {
                return fs.writeFile(tmpname, data, callback);
            }

            xlsx.write(tmpname, data, callback);

        }).catch(service.error);


        return service.deferred.promise;
    };


    return service;
};



'use strict';

const gt = require('./../../../../modules/gettext');


/**
 * Validate params fields
 * @param {apiService} service
 * @param {Object} params
 */
function validate(service, params)
{

    if (service.needRequiredFields(params, ['user', 'lastname', 'firstname', 'email'])) {
        return;
    }

    saveUser(service, params);
}





function saveAccount(service, params, user) {

    let AccountModel = service.app.db.models.Account;

    if (undefined === params.roles.account.notify) {
        return Promise.resolve(null);
    }

    let fieldsToSet = {
        notify: {
            approvals: params.roles.account.notify.approvals,
            allocations: params.roles.account.notify.allocations
        }
    };

    return AccountModel.findById(user.roles.account).exec()
    .then(account => {
        account.set(fieldsToSet);
        return account.save();
    });

}


/**
 * Update/create the user document
 *
 * @param {apiService} service
 * @param {Object} params
 */
function saveUser(service, params) {


    let UserModel = service.app.db.models.User;


    let fieldsToSet = {
        firstname: params.firstname,
        lastname: params.lastname,
        email: params.email,
        image: params.image
    };

    if (params.google && params.google.calendar) {
        if (undefined === fieldsToSet.google) {
            fieldsToSet.google = {};
        }

        fieldsToSet.google.calendar = params.google.calendar;
    }

    UserModel.findById(params.user).exec()
    .then(function(user) {

        user.set(fieldsToSet);
        return user.save();
    })
    .then(user => {
        return saveAccount(service, params, user);
    })
    .then(() => {
        service.resolveSuccessGet(
            { user: params.user },
            gt.gettext('Your settings has been modified')
        );
    })
    .catch(service.error);
}










/**
 * Construct the settings save service
 * @param   {object}          services list of base classes from apiService
 * @param   {express|object}  app      express or headless app
 * @returns {saveItemService}
 */
exports = module.exports = function(services, app) {

    var service = new services.save(app);

    /**
     * Call the right type save service
     *
     * @param {Object} params
     *
     * @return {Promise}
     */
    service.getResultPromise = function(params) {
        validate(service, params);
        return service.deferred.promise;
    };


    return service;
};



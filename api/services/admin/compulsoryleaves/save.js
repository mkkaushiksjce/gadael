'use strict';


const gt = require('./../../../../modules/gettext');
const saveAbsence = require('./../../user/requests/saveAbsence');
var Services = require('restitute').service;

/**
 * Validate params fields
 * @param {apiService} service
 * @param {Object} params
 */
function validate(service, params) {

    if (service.needRequiredFields(params, ['dtstart', 'dtend', 'name', 'userCreated', 'collections', 'departments', 'right'])) {
        return;
    }

    if (params.dtend <= params.dtstart) {
        return service.error(gt.gettext('Finish date must be greater than start date'));
    }

    if (params.collections.constructor !== Array) {
        return service.error(gt.gettext('collections must be an array'));
    }

    if (params.departments.constructor !== Array) {
        return service.error(gt.gettext('departments must be an array'));
    }

    if (params.departments.length === 0 && params.collections.length === 0) {
        return service.error(gt.gettext('either departments or collections must contain items'));
    }

    saveCompulsoryLeave(service, params);
}



function getIds(list) {
    return list.map(item => {
        if (typeof item === 'string') {
            return item;
        }

        if (item._id !== undefined) {
            return item._id;
        }

        throw new Error('wrong data type');
    });
}







/**
 * save all new requests
 * @param {apiService} service
 * @param {Object} params
 * @return {Promise}
 */
function saveRequests(service, params) {


    /**
     * Get user document with validation
     * @throws {Error} [[Description]]
     * @param   {String} userId [[Description]]
     * @returns {Promise} [[Description]]
     */
    function getUser(userId) {
        let User = service.app.db.models.User;

        return User.findOne({ _id:userId })
        .populate('roles.account')
        .populate('department')
        .exec()
        .then(user => {
            if (!user) {
                throw new Error('User not found');
            }

            if (!user.roles.account) {
                throw new Error('User have no absences account');
            }

            return user;
        });
    }

    /**
     * Get right document with validation
     * @throws {Error} [[Description]]
     * @returns {Promise} [[Description]]
     */
    function getRight() {
        let Right = service.app.db.models.Right;

        return Right.findOne({ _id:params.right })
        .populate('type')
        .exec()
        .then(right => {
            if (!right) {
                throw new Error('Right not found');
            }

            return right;
        });
    }


    /**
     * Get list of events between two date
     * @return {Promise}
     */
    function getEvents(user) {
        let calendarevents = Services.load(service.app, 'user/calendarevents/list');

        return calendarevents.getResultPromise({
            user: user._id,
            dtstart: params.dtstart,
            dtend: params.dtend,
            type: 'workschedule',
            substractNonWorkingDays: true,
            substractPersonalEvents: true
        });
    }



    /**
     * Create one user request
     * @param {String} userId
     * @return {Promise}
     */
    function createRequest(userId) {

        let fieldsToSet;

        let Request = service.app.db.models.Request;

        Promise.all([
            getUser(userId),
            getRight()
        ])
        .then(all => {

            let user = all[0];
            //let right = all[1];

            fieldsToSet = {
                user: {
                    id: user._id,
                    name: user.getName()
                },
                approvalSteps: [],
                absence: {},
                status: {
                    created: 'accepted'
                }
            };

            if (user.department) {
                fieldsToSet.user.department = user.department.name;
            }

            getEvents(user).then(events => {

                let element = {
                    events: events,
                    user: fieldsToSet.user,
                    right: {
                        id: params.right
                    }
                };

                fieldsToSet.absence.distribution = [element];

                return saveAbsence.getCollectionFromDistribution(fieldsToSet.absence.distribution, user.roles.account);

            })
            .then(function(rightCollection) {

                if (null !== rightCollection) {
                    fieldsToSet.absence.rightCollection = rightCollection._id;
                }

                return saveAbsence.saveAbsenceDistribution(service, user, params.absence, rightCollection);
            })
            .then(distribution => {

                fieldsToSet.events = saveAbsence.getEventsFromDistribution(distribution);
                fieldsToSet.absence.distribution = distribution;


                let req = new Request();
                req.set(fieldsToSet);

                return req.save();
            });
        });
    }



    let promises = [];

    params.requests.forEach(compulsoryLeaveRequest => {

        if (compulsoryLeaveRequest.request) {
            // allready created
            return;
        }

        promises.push(createRequest(compulsoryLeaveRequest.user.id));

    });

    return Promise.all(promises);

}




/**
 * Update/create the compulsory leave document
 *
 * @param {apiService} service
 * @param {Object} params
 */
function saveCompulsoryLeave(service, params) {


    let CompulsoryLeaveModel = service.app.db.models.CompulsoryLeave;

    let rightId;

    if (params.right._id === undefined) {
        rightId = params.right;
    } else {
        rightId = params.right._id;
    }

    var fieldsToSet = {
        name: params.name,
        description: params.description,
        dtstart: params.dtstart,
        dtend: params.dtend,
        lastUpdate: new Date(),
        userCreated: {
            id: params.userCreated._id,
            name: params.userCreated.getName()
        },
        collections: getIds(params.collections),
        departments: getIds(params.departments),
        right: rightId
    };


    saveRequests(service, params).then(requests => {


        fieldsToSet.requests = requests;

        if (params.id)
        {
            CompulsoryLeaveModel.findOne({ _id: params.id }, function(err, document) {
                if (service.handleMongoError(err))
                {
                    document.set(fieldsToSet);
                    document.save(function(err, document) {

                        if (service.handleMongoError(err)) {

                            service.resolveSuccess(
                                document,
                                gt.gettext('The compulsory leave period has been modified')
                            );

                        }

                    });


                }
            });

        } else {

            var document = new CompulsoryLeaveModel();
            document.set(fieldsToSet);
            document.save(function(err, document) {

                if (service.handleMongoError(err))
                {
                    service.resolveSuccess(
                        document,
                        gt.gettext('The compulsory leave period has been created')
                    );
                }
            });
        }

    });
}










/**
 * Construct the compulsory leave save service
 * @param   {object}          services list of base classes from apiService
 * @param   {express|object}  app      express or headless app
 * @returns {saveItemService}
 */
exports = module.exports = function(services, app) {

    var service = new services.save(app);

    /**
     * Call the compulsory leave save service
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



'use strict';

var app = require('../../../api/Headless.api.js');


describe('User model', function() {

    var userModel;
    var userDocument;
    var department1, department2;


    it("should connect to the database", function(done) {
		app.connect(function() {
            userModel = app.db.models.User;
			done();
		});
	});


    it('create a random test user', function(done) {
        userModel.createRandom('secret', function(err, user) {
            userDocument = user;
            done();
        });
    });

    it('check departments ancestors without departments', function(done) {
        userDocument.getDepartmentsAncestors().then(function(arr) {
            expect(arr.length).toEqual(0);
            done();
        });
    });


    it('set a department on test user', function(done) {

        function saveToUser(department) {
            userDocument.department = department._id;
            userDocument.save(function(err) {
                expect(err).toEqual(null);
                department1 = department;
                done();
            });
        }

        app.db.models.Department.findOne().where('name', 'R & D').exec(function(err, department) {
            expect(err).toEqual(null);
            if (department) {
                department.save(function(err) {
                    saveToUser(department);
                });
                return;
            }

            department = new app.db.models.Department();
            department.name = 'R & D';
            department.save(function(err) {
                expect(err).toEqual(null);
                saveToUser(department);


            });
        });
    });


    it('check departments ancestors with one department', function(done) {
        userDocument.getDepartmentsAncestors().then(function(arr) {
            expect(arr.length).toEqual(1);
            done();
        });
    });


    it('create a parent department', function(done) {

        function saveToDepartment1(department) {
            department1.parent = department;
            department1.save(function(err) {
                expect(err).toEqual(null);
                department2 = department;
                done();
            });
        }


        app.db.models.Department.findOne().where('name', 'France').exec(function(err, department) {
            expect(err).toEqual(null);
            if (department) {
                return saveToDepartment1(department);
            }

            department = new app.db.models.Department();
            department.name = 'France';
            department.save(function(err) {
                expect(err).toEqual(null);
                saveToDepartment1(department);
            });
        });
    });


    it('check departments ancestors with two department', function(done) {
        userDocument.getDepartmentsAncestors().then(function(arr) {
            expect(arr.length).toEqual(2);
            done();
        });
    });


    it("should disconnect from the database", function(done) {

        department1.remove(function() {
            department2.remove(function() {
                app.disconnect(function() {
                    done();
                });
            });
        });
	});
});
Feature: Example feature
	As a user of restifizer-files
	I want to have ability to create full-functional RESTful file-services
	
	Scenario: Post file (GridFS)
        When I send post request to handle files.testFile
        Then I should get success with code 200

	Scenario: Put file (GridFS)
        When I send put request to handle files.testFile
        Then I should get success with code 200

    Scenario: Get file (GridFS)
        When I send get request to handle files.testFile
        Then I should get success with code 200
        And I get an array with length equals to 174540 in response

    Scenario: Delete file (GridFS)
        When I send delete request to handle files.testFile
        Then I should get success with code 200

    Scenario: Post file (local storage)
        When I send post request to handle files.testFileLocal
        Then I should get success with code 200

    Scenario: Put file (local storage)
        When I send put request to handle files.testFileLocal
        Then I should get success with code 200

    Scenario: Get file (local storage)
        When I send get request to handle files.testFileLocal
        Then I should get success with code 200
        And I get an array with length equals to 174540 in response

    Scenario: Delete file (local storage)
        When I send delete request to handle files.testFileLocal
        Then I should get success with code 200
local JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwidXNlcm5hbWUiOiJNZXN0cmVQZWRybzEwMCIsImV4cCI6MTc2MTI2OTU1OH0.viERxFYOT2isEVdOcDo688LJXQO-aZ38SWcyvhI3IuA"

local headers = {
    ["Authorization"] = "Bearer " .. JWT_TOKEN
}

counter = 0

request = function()
    counter = counter + 1
    return wrk.format("GET", "/api/user/users/" .. counter, headers)
end
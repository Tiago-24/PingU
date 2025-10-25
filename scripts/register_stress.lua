local function generate_unique_id()
  local timestamp = tostring(os.time() * 1000 + math.random(1, 999))
  local random_part = string.format("%08x", math.random(0xFFFFFFFF))
  return timestamp .. random_part
end

request = function()
  local unique_id = generate_unique_id()
  local username = "LegitUser_" .. unique_id
  local password = "Sup3r!StrongPass_" .. unique_id
  local body = string.format('{"username":"%s","password":"%s"}', username, password)
  return wrk.format("POST", "/api/user/register", nil, body)
end

-- Initialize the random seed ONCE outside the request function
math.randomseed(os.time())
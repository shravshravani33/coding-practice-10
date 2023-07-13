const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const path = require("path");
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,

      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);

    process.exit(1);
  }
};

initializeDbAndServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SKey", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

////1.API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
      SELECT * 
      FROM user
      WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SKey");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

////API 2
app.get("/states/", authenticationToken, async (request, response) => {
  //const { stateId, stateName, population } = request.body;
  const getAllStatesQuery = `
      SELECT * FROM state`;
  const statesArray = await db.all(getAllStatesQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

//API3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId, stateName, population } = request.params;
  const getStateQuery = `
      SELECT * FROM state
        WHERE state_id = '${stateId}';`;
  const stateR = await db.get(getStateQuery);
  response.send(convertStateDbObjectToResponseObject(stateR));
});

///API4
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDstQuery = `
    INSERT 
      INTO 
      district(district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  const postDstR = await db.run(postDstQuery);
  response.send("District Successfully Added");
});

////API5
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictsQuery = `
    SELECT
      *
    FROM
     district
    WHERE
      district_id = '${districtId}';`;
    const district = await db.get(getDistrictsQuery);
    response.send(convertDistrictDbObjectToResponseObject(district));
  }
);

////API 6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDisQuery = `
      DELETE FROM district
       WHERE district_id = '${districtId}';`;
    const delDst = await db.get(getDisQuery);
    response.send("District Removed");
  }
);

///API 7
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const getDisQuery = `
      UPDATE
       district
      SET
        district_name = '${districtName}',
        state_id = '${stateId}',
        cases ='${cases}',
        cured = '${cured}',
        active ='${active}',
        deaths = '${deaths}'
       WHERE district_id = '${districtId}';`;
    await db.get(getDisQuery);
    response.send("District Details Updated");
  }
);

////API 8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const stats = `
      SELECT SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
      FROM district
      WHERE
        state_id = '${stateId}';`;
    const statsR = await db.get(stats);
    response.send(statsR);
  }
);

module.exports = app;

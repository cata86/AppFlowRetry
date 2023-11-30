const AWS = require('aws-sdk');

const appflow = new AWS.Appflow();

exports.handler = async (event) => {
  console.info("EVENT\n" + JSON.stringify(event, null, 2))
  const flowName = event.detail['flow-name'];
  
  try {
    await executeAppFlow(flowName);
  } catch (error) {
    console.error(error);
    throw error;
  }
  
};

const executeAppFlow = async (flowName) => {
  const params = {
    flowName: flowName, 
  };
  await appflow.startFlow(params).promise();
  
};
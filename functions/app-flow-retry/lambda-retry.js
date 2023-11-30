//Copyright 2023 Amazon.com and its affiliates; all rights reserved. This file is Amazon Web Services Content and may not be duplicated or distributed without permission.
const AWS = require('aws-sdk');

const stepfunctions = new AWS.StepFunctions();
const sns = new AWS.SNS();
const appflow = new AWS.Appflow();

exports.handler = async (event) => {
  console.info("EVENT\n" + JSON.stringify(event, null, 2))
  const flowName = event.detail['flow-name'];
  const status = event.detail.status;
  const intervalMinutesRetry = process.env.IntervalMinutes; 
  const maxRetry = process.env.MaxRetry;
  const minutesAgo = intervalMinutesRetry*maxRetry+120;
  
  
  if (status === 'Failed' || status === 'Execution Failed') {
    try {
      const executions = await listExecutions(flowName,minutesAgo,maxRetry);
      if (executions.length >= maxRetry) {
        await sendSNSMessage('The flow has failed in the last '+maxRetry+' executions\n\n'+JSON.stringify(event, null, 2),flowName);
      }else{
        await retryFlowExecution(event,flowName,executions.length * intervalMinutesRetry * 60);
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
};

const listExecutions = async (flowName,minutesAgo,maxRetry) => {
  const startTime = new Date();
  startTime.setMinutes(startTime.getMinutes() - minutesAgo); 
  const params = {
    maxResults: maxRetry,
    flowName: flowName
  };
  const response = await appflow.describeFlowExecutionRecords(params).promise();
  const filteredRecords = response.flowExecutions.filter(record => {
      const executionTimeEnd = new Date(record.lastUpdatedAt);
      const executionStatus = record.executionStatus;
      return executionTimeEnd >= startTime && (executionStatus === "Error" || executionStatus === 'Execution Failed');
  });

  console.info("Last Executions \n" + JSON.stringify(filteredRecords, null, 2))
  return filteredRecords;
};

const sendSNSMessage = async (message,appFlowName) => {
  const params = {
    TopicArn: process.env.SNStopicArn,
    Message: message,
    Subject: "Failed AppFlow - "+appFlowName
  };
  console.info("Send Message to SNS TOPIC: "+ process.env.SNStopicArn);
  await sns.publish(params).promise();
};

const retryFlowExecution = async (event,flowName,waitTimeMinutes) => {
  const stateMachineArn = process.env.StateMachineArn;
  console.info("retryFlowExecution state machine: " + stateMachineArn);
  event.detail.executeNow = true;
  const input = JSON.stringify({ seconds: waitTimeMinutes, event: event }); // X minuti da aspettare
  const params = {
    stateMachineArn,
    name: `RetryFlowExecution-${flowName}-${Date.now()}`,
    input
  };
  await stepfunctions.startExecution(params).promise();
};

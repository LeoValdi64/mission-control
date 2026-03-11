#!/bin/bash
# Mission Control Agent Heartbeat
# Pings all agents to keep them online

API_KEY="14PIuskd09w6A0P3rLmwp_fuiVrMLNug5LFLEtbZFSg"
MC_URL="http://127.0.0.1:3333"

# Heartbeat for all registered agents
# 1=Jireh, 2=LeoValdi, 3=GM, 11=Sales, 12=Ops, 13=Legal, 14=HR, 15=Analytics, 16=QC, 17=Finance
for id in 1 2 3 11 12 13 14 15 16 17; do
  curl -s -X GET "${MC_URL}/api/agents/${id}/heartbeat" \
    -H "x-api-key: ${API_KEY}" > /dev/null 2>&1
done

import dynamodb from "../utils/shared/dynamodb";
import { dailyTokensTvl, dailyTvl, dailyUsdTokensTvl, hourlyTvl } from "../utils/getLastRecord";
import { getProtocol } from "./utils";
import { PromisePool } from '@supercharge/promise-pool'
import { clearProtocolCacheById } from "./utils/clearProtocolCache";


async function main() {
  const protocolName = "FlokiFi Locker"
  const dateFromStr = '2022-09-02'
  const dateToStr = '2022-08-16'
  console.log('Deteting data for protcol: ', protocolName)
  console.log('From: ', dateFromStr)
  console.log('Till: ', dateToStr)
  const protocol = getProtocol(protocolName)
  const deleteFrom = (+new Date(dateFromStr)) / 1000
  const deleteTo = (+new Date(dateToStr)) / 1000
  for (const tvlFunc of [dailyTokensTvl, dailyTvl, dailyUsdTokensTvl,
    // hourlyTvl // - we retain hourly in case we want to refill using it for some reason
  ]) {
    const data = await dynamodb.query({
      ExpressionAttributeValues: {
        ":pk": tvlFunc(protocol.id),
        ":from": deleteFrom,
        ":to": deleteTo,
      },
      KeyConditionExpression: "PK = :pk AND SK > :from AND SK < :to",
    });
    const items = data.Items ?? []
    console.log('have to delete ', items.length, ' items, table:', tvlFunc(protocol.id))
    await PromisePool
      .withConcurrency(42)
      .for(items)
      .process(async (d: any) => {
        await dynamodb.delete({
          Key: {
            PK: d.PK,
            SK: d.SK,
          },
        });
      })

  }
  return clearProtocolCacheById(protocol.id)
}

main().then(() => {
  console.log('Done!!!')
  process.exit(0)
})

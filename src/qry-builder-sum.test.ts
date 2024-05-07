import {
  Collection,
  Entity,
  ManyToOne,
  MikroORM,
  OneToMany,
  PrimaryKey,
  PrimaryKeyProp,
  Property,
  wrap,
  ref,
  Reference,
  Ref,
} from "@mikro-orm/sqlite";

@Entity()
class User {
  @PrimaryKey()
  id!: number;

  @Property()
  name: string;

  @Property({ unique: true })
  email: string;

  @OneToMany({
    entity: () => Transaction,
    mappedBy: "buyer",
    orphanRemoval: true,
  })
  jncPurchases = new Collection<Transaction>(this);

  @OneToMany({
    entity: () => Transaction,
    mappedBy: "seller",
    orphanRemoval: true,
  })
  jncSales = new Collection<Transaction>(this);

  constructor(name: string, email: string) {
    this.name = name;
    this.email = email;
  }
}

@Entity()
class Transaction {
  [PrimaryKeyProp]?: ["lender", "debtor"];

  @ManyToOne({
    type: User,
    primary: true,
    updateRule: "cascade",
    deleteRule: "cascade",
    ref: true,
  })
  buyer!: Ref<User>;

  @ManyToOne({
    type: User,
    primary: true,
    updateRule: "cascade",
    deleteRule: "cascade",
    ref: true,
  })
  seller!: Ref<User>;

  @Property()
  amount: number = 0;

  constructor(buyer: User, seller: User, amount: number = 0) {
    this.buyer = ref(buyer);
    this.seller = ref(seller);
    this.amount = amount;
  }
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ":memory:",
    entities: [User, Reference<User>, Transaction],
    debug: ["query", "query-params"],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();

  const foo = new User("Foo", "foo");
  const bar = new User("Bar", "bar");

  const tnxs = [new Transaction(foo, bar, 100), new Transaction(bar, foo, 200)];
  await orm.em.persistAndFlush(tnxs);
});

afterAll(async () => {
  await orm.close(true);
});

test("Sum Foo sales raw", async () => {
  const found = await orm.em.findOneOrFail(User, { email: "foo" });
  expect(found.jncSales[0].amount).toEqual(200);

  const resultsRaw = await orm.em
    .getKnex()
    .raw(
      "select `u`.`id` as `id`, sum(t.amount) as `total` from `user` as `u` left join `transaction` as `t` on `u`.`id` = `t`.`seller_id` where `u`.`email` = 'foo'"
    );
  expect(resultsRaw).toEqual([{ id: 1, total: 200 }]);
});

test("Sum Foo sales knex", async () => {
  const found = await orm.em.findOneOrFail(User, { email: "foo" });
  expect(found.jncSales[0].amount).toEqual(200);

  const resultsRaw = await orm.em
    .getKnex()
    .select("u.id as id")
    .from("user as u")
    .leftJoin("transaction as t", "u.id", "t.seller_id")
    .where({ email: "foo" })
    .sum("t.amount as total");

  expect(resultsRaw).toEqual([{ id: 1, total: 200 }]);
});

test('Sum Foo sales using qb', async () => {
  const results = await orm.em.createQueryBuilder(User, 'u')
  .select(['u.id as id', 'sum(t.amount) as total'])
  .leftJoin('u.jncSales', 't')
  .where({ email: 'foo' })
  .getResultList();

  expect(results).toEqual([{ id: 1, total: 200 }]);
});

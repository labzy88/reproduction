import { Collection, Entity, ManyToOne, MikroORM, OneToMany, PrimaryKey, PrimaryKeyProp, Property, wrap, ref, Reference, Ref } from '@mikro-orm/sqlite';

@Entity()
class User {

  @PrimaryKey()
  id!: number;

  @Property()
  name: string;

  @Property({ unique: true })
  email: string;

  @OneToMany({ entity: () => Transaction, mappedBy: 'buyer', orphanRemoval: true })
  jncPurchases = new Collection<Transaction>(this);

  @OneToMany({ entity: () => Transaction, mappedBy: 'seller', orphanRemoval: true })
  jncSales = new Collection<Transaction>(this);

  constructor(name: string, email: string) {
    this.name = name;
    this.email = email;
  }

}

@Entity()
class Transaction {

  [PrimaryKeyProp]?: ['lender', 'debtor'];

  @ManyToOne({ type: User, primary: true, updateRule: 'cascade', deleteRule: 'cascade', ref: true })
  buyer!: Ref<User>;

  @ManyToOne({ type: User, primary: true, updateRule: 'cascade', deleteRule: 'cascade', ref: true })
  seller!: Ref<User>;

  @Property()
  amount: number = 0;

  constructor(buyer: User, seller: User, amount: number = 0) {
    this.buyer = ref(buyer)
    this.seller = ref(seller)
  }

}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [User, Reference<User>, Transaction],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test('Unpopulated jnc when serialized', async () => {
  const foo = new User('Foo', 'foo');
  const bar = new User('Bar', 'bar');
  const tnxs = [
    new Transaction(foo, bar, 100),
    new Transaction(bar, foo, 200),
  ];

  await orm.em.persistAndFlush(tnxs);

  await orm.em.findOneOrFail(User, { email: 'foo' });

  const em = orm.em.fork();
  await em.begin();
  try {
    await em.nativeDelete(User, { email: 'foo' });
    throw new Error('Reverse deletion');
    await em.commit(); // calls flush
  } catch (e) {
    await em.rollback();
  }

  await orm.em.findOneOrFail(User, { email: 'foo' });

  await em.begin();
  try {
    await em.nativeDelete(User, { email: 'foo' });
    await em.commit(); // calls flush
  } catch (e) {
    await em.rollback();
  }

  const found = await orm.em.findOne(User, { email: 'foo' });
  expect(found).toBeNull();
});

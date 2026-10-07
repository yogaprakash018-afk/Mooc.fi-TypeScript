import express, {
    type Express,
    type Request,
    type Response,
    type NextFunction
} from "express";
import cors from 'cors';
import data1, { type Diagnosis } from "./data/diagnosis.ts";
import data2, { type genric } from './data/patients.ts';
import { v1 as uuid } from 'uuid';
import z from 'zod';

const diagnoses: Diagnosis[] = data1;

type Patient = Omit<genric, "ssn">;

const Gender = {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other',
} as const;
type Gender = typeof Gender[keyof typeof Gender];

function omitSSN(arrObjs: genric[]) {
    return arrObjs.map(({ id, name, dateOfBirth, gender, occupation }) => ({
        id,
        name,
        dateOfBirth,
        gender,
        occupation,
    }));
}

const patients: Patient[] = omitSSN(data2);

const NewEntrySchema = z.object({
    name: z.string(),
    dateOfBirth: z.iso.date(), //ISO date string such as "2000-05-20"
    gender: z.enum(Gender),
    occupation: z.string()
});

// Instead of manually writing the NewPatient type, TypeScript gets the type directly from the Zod schema.
// This means the Zod schema is now the single source of truth for the shape of a new patient.

type NewPatient = z.infer<typeof NewEntrySchema>;

// const toNewPatientEntry = (object: unknown): NewPatient => {
//     return NewEntrySchema.parse(object);
// };

// We no longer need the toNewPatientEntry function. Instead, the validation is moved into middleware.
// Middleware runs BEFORE the actual route handler. If the request body is valid, next() allows the request to continue to the route handler.
// If the request body is invalid, parse() throws a ZodError, which is passed to the error-handling middleware using next(error).

const newPatientParser = (req: Request, _res: Response, next: NextFunction) => {
    try {
        NewEntrySchema.parse(req.body);
        next();
    } catch (error: unknown) {
        next(error);
    };
};

const app: Express = express();
const port: number = 3001;
const corsOptions = {
    origin: "http://localhost:5173",
    methods: ['GET', 'POST'],
};

app.use(express.json());
app.use(cors(corsOptions));

app.get('/api/ping', (_req, res) => {
    console.log("Someone pinged");
    res.send("Someone pinged here");
});

app.get("/api/patients", (_req, res) => {
    res.send(patients);
});

app.get("/api/diagnoses", (_req, res) => {
    res.send(diagnoses);
});

// newPatientParser runs FIRST.
//
// Request
//    ↓
// newPatientParser
//    ↓
// Zod validates req.body
//    ↓
// next()
//    ↓
// route handler
//
// If validation fails:
//
// Request
//    ↓
// newPatientParser
//    ↓
// ZodError
//    ↓
// next(error)
//    ↓
// errorMiddleware
//
// Request<unknown, unknown, NewPatient> tells TypeScript that req.body is a NewPatient inside this route handler.
//
// The third generic parameter of Request represents the type of req.body.

app.post("/api/patients", newPatientParser, (req: Request<unknown, unknown, NewPatient>, res: Response<Patient>) => {
        // At this point the middleware has already validated req.body using NewEntrySchema.
        // Therefore we can directly use req.body as NewPatient.
        const newPatient: Patient = {
            id: uuid(),
            ...req.body,
        };
        patients.push(newPatient);
        res.json(newPatient);
    }
);

// Error-handling middleware. Express recognizes this as error middleware because
// it has FOUR parameters:
// error, req, res, next
// When newPatientParser calls next(error), Express skips the normal route handlers and sends the error here. If the error is a ZodError, we send the validation problems back to the client with status 400.
// If it is some other error, we pass it to the next error-handling middleware using next(error).

const errorMiddleware = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
        const errorMessage = 'Error in adding patient to library';
        console.log(errorMessage);
        res.status(400).send({
            error: error.issues
        });
    } else {
        console.log('Unknown error');
        res.status(400).send({
            error: 'unknown error'
        });
        // If you wanted another error middleware to handle
        // unknown errors instead, you could use:
        // next(error);
    };
};

// Error middleware should be registered after the routes,
// because it handles errors passed from the middleware/routes above.

app.use(errorMiddleware);
app.listen(port, () => {
    console.log("Successfully listening to port: ", port);
});

// const parseName = (name: unknown): string => {
//     // if (!isString(name) || name === '') {
//     //     // Before the type guard is called, the actual type of the variable comment is not known:
//     //     throw new Error('Incorrect or missing name');
//     // }
//     // return name;
//     // But after the call, if the code proceeds past the exception (that is, the type guard returned true), then the compiler knows that the comment is of type string
//     return z.string().parse(name); // unlike safeparse() parse breaks the execution and throws error for wrong data.
// };

// const isDate = (date: string): boolean => {
//     return Boolean(Date.parse(date)); // Parses a string containing a date, and returns the number of milliseconds between that date and midnight, January 1, 1970.
// };

// const parseDateOfBirth = (date: unknown): string => {
//     if (!isString(date) || date === '' || !isDate(date)) {
//         throw new Error('Incorrect or missing date of birth: ' + date);
//     }
//     return date;
// };

// const parseGender = (gender: unknown): Gender => {
//     if (!isGender(gender)) {
//         throw new Error('Incorrect or missing gender: ' + gender);
//     }
//     return gender;
// };

// const isGender = (gender: unknown): gender is Gender => {
//     return typeof gender === 'string' && Object.values(Gender).includes(gender as Gender);
//     // unlike in the course here it's - (gender as Gender).
//     // To make it simpe gender is a string and when we give something or this gender to Gender interface as const, it expects Gender rather string.
//     // so includes might throw error that's why assume or assert type Gender to gender string then check if Gender includes gender.
//     // But how includes? isn't it array method, Object.values return array of Gender so we can use includes.
//     // But in course same but Object.values(Weather) as string[] here take the Weather interface get it's values as array and assert them as string then simply .includes(weather or param), no need of assertion here too.
// };

// if (!object || typeof object !== 'object') {
//         throw new Error('Incorrect or missing data');
//     }

//     if (
//         'name' in object &&
//         'dateOfBirth' in object &&
//         'gender' in object &&
//         'occupation' in object
//     ) {
//         // in the above if we can use Object.hasOwn(object, name) but the problem is now that in top if we made sure that object is type Object,
//         // TypeScript cannot infer it has name property using hasOwn() so rather using in keyword checks existense of key itself rather true or false.
//         const newEntry: NewPatientEntry = {
//             name: z.string().parse(object.name), // string() returns a object inside it has parse function.
//             dateOfBirth: z.string().parse(object.dateOfBirth),
//             gender: z.enum(Gender).parse(object.gender),
//             occupation: parseOccupation(object.occupation),
//         };
//         return newEntry;
//     };
//     throw new Error('Incorrect data: some fields are missing');

// const isString = (text: unknown): text is string => { // type predicate is parameterName of function is keyword Type keyword and of which is correct or wrong type like here string.
//     return typeof text === 'string' || text instanceof String;
//     // If the type guard function returns true, the TypeScript compiler knows that the tested variable has the type that was defined in the type predicate.
// };

// const parseOccupation = (occupation: unknown): string => {
//     if (!isString(occupation) || occupation === '') {
//         throw new Error('Incorrect or missing occupation');
//     }
//     return occupation;
// };
# Csharp-to-Typescript
A small JS script that converts a C# class record to typescript interfaces. Enums are currently not supported.

## Steps to use
* Replace `CSHARP` on line 5 with the value of the C# model.
* Set the `CAMEL_CASE` option if you want Camel Case.
* Run with node `node cs2ts.js`.
* An invalid model will give a empty string as the result to Std IO.

## Conversion examples
```csharp
public class Person
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public int Age { get; set; }
}
```
will be converted to
```typescript
export interface Person {
  FirstName: string;
  LastName: string;
  Age: number;
}
```
Similar for records
```csharp
public record Car(string Make, string Model, int Year);
```
Converted
```typescript
export interface Car {
  Make: string;
  Model: string;
  Year: number;
}
```

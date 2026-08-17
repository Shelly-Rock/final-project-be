import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsAfter(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const relatedPropertyName = String(args.constraints[0]);
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];

          if (!value || !relatedValue) return false;

          const currentDate = new Date(value as string | number | Date);
          const relatedDate = new Date(relatedValue as string | number | Date);

          if (!isNaN(currentDate.getTime()) && !isNaN(relatedDate.getTime())) {
            return currentDate.getTime() > relatedDate.getTime();
          }
          return false;
        },
        defaultMessage(args: ValidationArguments) {
          const relatedPropertyName = String(args.constraints[0]);
          return `${args.property} bắt buộc phải diễn ra sau ${relatedPropertyName}`;
        },
      },
    });
  };
}

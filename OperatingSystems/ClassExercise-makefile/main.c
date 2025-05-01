#include <stdio.h>
#include "string_utils.h"

int main()
{
    char str[100] = "Ofir Krisple - 207455791";

    printf("Original string:\n");
    print_string(str);

    reverse_string(str);

    printf("Reversed string:\n");
    print_string(str);

    return 0;
}